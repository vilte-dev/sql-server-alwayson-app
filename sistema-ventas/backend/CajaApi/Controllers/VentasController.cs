using System.Security.Claims;
using CajaApi.Data;
using CajaApi.Models;
using CajaApi.Services;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CajaApi.Controllers;

[ApiController]
[Authorize]
[Route("api/ventas")]
public class VentasController(Db db, IConfiguration config) : ControllerBase
{
    private static readonly string[] TiposPago = { "Efectivo", "Tarjeta", "QR" };

    private int UserId => int.Parse(User.FindFirstValue("uid")!);
    private bool EsAdmin => User.IsInRole("admin");
    private string? Ip => HttpContext.Connection.RemoteIpAddress?.ToString();

    // ------------------------------------------------------------
    // Registrar venta: todo en una transacción (venta + detalle + stock + auditoría)
    // ------------------------------------------------------------
    [HttpPost]
    public async Task<IActionResult> Crear(VentaRequest req)
    {
        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { error = "La venta no tiene productos." });
        if (!TiposPago.Contains(req.TipoPago))
            return BadRequest(new { error = "Tipo de pago no válido." });

        // Une líneas repetidas del mismo producto y redondea cantidades
        var items = req.Items
            .GroupBy(i => i.IdProducto)
            .Select(g => new ItemRequest(g.Key, Math.Round(g.Sum(x => x.Cantidad), 2)))
            .OrderBy(i => i.IdProducto)   // orden fijo: evita bloqueos cruzados entre cajas
            .ToList();

        if (items.Any(i => i.Cantidad <= 0 || i.Cantidad > 10000))
            return BadRequest(new { error = "Hay cantidades no válidas en la venta." });

        var tasa = config.GetValue("Caja:TasaImpuesto", 0.05m);

        using var cn = await db.OpenAsync();

        // Idempotencia: si esta misma venta ya se registró (reintento tras un corte), devuelve el ticket existente
        if (req.ClaveIdempotencia is Guid clavePrevia)
        {
            var previa = await cn.QuerySingleOrDefaultAsync<int?>(
                "SELECT id_venta FROM venta WHERE clave_idempotencia = @clave AND id_usuario = @Uid",
                new { clave = clavePrevia, Uid = UserId });
            if (previa is int idPrevia) return Ok(await ObtenerTicket(cn, idPrevia));
        }

        using var tx = cn.BeginTransaction();

        var turno = await Turnos.ActualAsync(cn, tx);
        if (turno is null)
            return Conflict(new { error = "No hay un turno activo a esta hora. Configura los turnos en la base de datos." });

        var lineas = new List<(int Id, string Nombre, decimal Cant, decimal Precio, decimal Sub)>();

        foreach (var it in items)
        {
            // Descuenta stock solo si alcanza; el precio se toma de la BD, nunca del navegador
            var p = await cn.QuerySingleOrDefaultAsync<LineaRow>("""
                UPDATE producto
                SET stock_actual = stock_actual - @Cant
                OUTPUT inserted.nombre, inserted.precio_venta
                WHERE id_producto = @Id AND estado = 1 AND stock_actual >= @Cant
                """, new { Id = it.IdProducto, Cant = it.Cantidad }, tx);

            if (p is null)
            {
                var info = await cn.QuerySingleOrDefaultAsync<StockRow>(
                    "SELECT nombre AS Nombre, stock_actual AS Stock FROM producto WHERE id_producto = @Id",
                    new { Id = it.IdProducto }, tx);
                var msg = info is null
                    ? "Uno de los productos ya no existe."
                    : $"Stock insuficiente de {info.Nombre} (disponible: {info.Stock:0.##}).";
                return Conflict(new { error = msg });
            }

            lineas.Add((it.IdProducto, p.Nombre, it.Cantidad, p.PrecioVenta, Math.Round(it.Cantidad * p.PrecioVenta, 2, MidpointRounding.AwayFromZero)));
        }

        var subtotal = lineas.Sum(l => l.Sub);
        var impuesto = Math.Round(subtotal * tasa, 2, MidpointRounding.AwayFromZero);
        var total = subtotal + impuesto;

        int idVenta;
        try
        {
            idVenta = await cn.QuerySingleAsync<int>("""
                INSERT INTO venta (id_usuario, id_turno, tipo_pago, subtotal, impuesto, total, clave_idempotencia)
                OUTPUT inserted.id_venta
                VALUES (@Uid, @Turno, @Pago, @Sub, @Imp, @Total, @Clave)
                """, new { Uid = UserId, Turno = turno.IdTurno, Pago = req.TipoPago, Sub = subtotal, Imp = impuesto, Total = total, Clave = req.ClaveIdempotencia }, tx);
        }
        catch (SqlException ex) when (req.ClaveIdempotencia is not null && ex.Number is 2601 or 2627)
        {
            // Otra petición con la misma clave se registró justo antes: deshace el descuento de stock de esta
            tx.Rollback();
            var existente = await cn.QuerySingleOrDefaultAsync<int?>(
                "SELECT id_venta FROM venta WHERE clave_idempotencia = @clave AND id_usuario = @Uid",
                new { clave = req.ClaveIdempotencia, Uid = UserId });
            if (existente is int idExistente) return Ok(await ObtenerTicket(cn, idExistente));
            return Conflict(new { error = "Esta venta ya fue procesada." });
        }

        await cn.ExecuteAsync("""
            INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario, subtotal)
            VALUES (@IdVenta, @IdProducto, @Cantidad, @PrecioUnitario, @Subtotal)
            """,
            lineas.Select(l => new { IdVenta = idVenta, IdProducto = l.Id, Cantidad = l.Cant, PrecioUnitario = l.Precio, Subtotal = l.Sub }),
            tx);

        await Auditoria.LogAsync(cn, tx, UserId, "VENTA", "venta", idVenta,
            $"Total {total:0.00} ({req.TipoPago}), {lineas.Count} producto(s)", Ip);

        tx.Commit();

        return Ok(await ObtenerTicket(cn, idVenta));
    }

    // ------------------------------------------------------------
    // Ventas de hoy (el cajero ve las suyas, el admin ve todas)
    // ------------------------------------------------------------
    [HttpGet("hoy")]
    public async Task<IActionResult> Hoy()
    {
        using var cn = await db.OpenAsync();
        var data = await cn.QueryAsync<VentaRow>("""
            SELECT v.id_venta, v.id_usuario, v.fecha_venta, v.tipo_pago, v.subtotal, v.impuesto, v.total, v.estado,
                   t.nombre_turno, e.nombres + ' ' + e.apellidos AS cajero
            FROM venta v
            JOIN turno t ON t.id_turno = v.id_turno
            JOIN usuario_sistema u ON u.id_usuario = v.id_usuario
            JOIN empleado e ON e.id_empleado = u.id_empleado
            WHERE v.fecha_venta >= CAST(CAST(SYSDATETIME() AS DATE) AS DATETIME2)
              AND (@EsAdmin = 1 OR v.id_usuario = @Uid)
            ORDER BY v.id_venta DESC
            """, new { EsAdmin = EsAdmin ? 1 : 0, Uid = UserId });
        return Ok(data);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Obtener(int id)
    {
        using var cn = await db.OpenAsync();
        var t = await ObtenerTicket(cn, id);
        if (t is null || (!EsAdmin && t.IdUsuario != UserId))
            return NotFound(new { error = "Venta no encontrada." });
        return Ok(t);
    }

    // ------------------------------------------------------------
    // Anular venta (solo admin): devuelve el stock
    // ------------------------------------------------------------
    [Authorize(Roles = "admin")]
    [HttpPost("{id:int}/anular")]
    public async Task<IActionResult> Anular(int id)
    {
        using var cn = await db.OpenAsync();
        using var tx = cn.BeginTransaction();

        var estado = await cn.QuerySingleOrDefaultAsync<bool?>(
            "SELECT estado FROM venta WITH (UPDLOCK) WHERE id_venta = @id", new { id }, tx);

        if (estado is null) return NotFound(new { error = "Venta no encontrada." });
        if (estado == false) return Conflict(new { error = "La venta ya estaba anulada." });

        await cn.ExecuteAsync("UPDATE venta SET estado = 0 WHERE id_venta = @id", new { id }, tx);
        await cn.ExecuteAsync("""
            UPDATE p SET p.stock_actual = p.stock_actual + d.cantidad
            FROM producto p
            JOIN detalle_venta d ON d.id_producto = p.id_producto
            WHERE d.id_venta = @id
            """, new { id }, tx);

        await Auditoria.LogAsync(cn, tx, UserId, "ANULAR_VENTA", "venta", id, "Venta anulada, stock devuelto", Ip);
        tx.Commit();

        return Ok(await ObtenerTicket(cn, id));
    }

    // ------------------------------------------------------------
    private static async Task<VentaRow?> ObtenerTicket(SqlConnection cn, int id)
    {
        var v = await cn.QuerySingleOrDefaultAsync<VentaRow>("""
            SELECT v.id_venta, v.id_usuario, v.fecha_venta, v.tipo_pago, v.subtotal, v.impuesto, v.total, v.estado,
                   t.nombre_turno, e.nombres + ' ' + e.apellidos AS cajero
            FROM venta v
            JOIN turno t ON t.id_turno = v.id_turno
            JOIN usuario_sistema u ON u.id_usuario = v.id_usuario
            JOIN empleado e ON e.id_empleado = u.id_empleado
            WHERE v.id_venta = @id
            """, new { id });
        if (v is null) return null;

        var det = await cn.QueryAsync<DetalleRow>("""
            SELECT d.id_producto, p.nombre, p.unidad_medida, d.cantidad, d.precio_unitario, d.subtotal
            FROM detalle_venta d
            JOIN producto p ON p.id_producto = d.id_producto
            WHERE d.id_venta = @id
            ORDER BY d.id_detalle
            """, new { id });
        v.Detalles = det.ToList();
        return v;
    }
}
