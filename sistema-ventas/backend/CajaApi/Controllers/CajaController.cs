using CajaApi.Data;
using CajaApi.Models;
using CajaApi.Services;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CajaApi.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class CajaController(Db db, IConfiguration config) : ControllerBase
{
    /// <summary>Turno actual e impuesto vigente.</summary>
    [HttpGet("caja/info")]
    public async Task<IActionResult> Info()
    {
        using var cn = await db.OpenAsync();
        var turno = await Turnos.ActualAsync(cn);
        return Ok(new
        {
            turno = turno is null ? null : new { turno.IdTurno, turno.NombreTurno, HoraInicio = turno.HoraInicio.ToString(@"hh\:mm"), HoraFin = turno.HoraFin.ToString(@"hh\:mm") },
            tasaImpuesto = config.GetValue("Caja:TasaImpuesto", 0.05m)
        });
    }

    [HttpGet("categorias")]
    public async Task<IActionResult> Categorias()
    {
        using var cn = await db.OpenAsync();
        var data = await cn.QueryAsync<Categoria>(
            "SELECT id_categoria, nombre, descripcion FROM categoria WHERE estado = 1 ORDER BY id_categoria");
        return Ok(data);
    }

    /// <summary>Productos activos con su stock actual (la caja filtra y busca en el navegador).</summary>
    [HttpGet("productos")]
    public async Task<IActionResult> Productos()
    {
        using var cn = await db.OpenAsync();
        var data = await cn.QueryAsync<Producto>("""
            SELECT p.id_producto, p.codigo_barras, p.nombre, p.id_categoria, c.nombre AS categoria,
                   p.precio_venta, p.stock_actual, p.stock_minimo, p.unidad_medida,
                   p.imagen_url, p.origen, p.calorias
            FROM producto p
            JOIN categoria c ON c.id_categoria = p.id_categoria
            WHERE p.estado = 1 AND c.estado = 1
            ORDER BY p.id_categoria, p.nombre
            """);
        return Ok(data);
    }
}
