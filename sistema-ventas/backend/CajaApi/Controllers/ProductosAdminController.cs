using System.Net;
using System.Net.Sockets;
using System.Security.Claims;
using CajaApi.Data;
using CajaApi.Models;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CajaApi.Controllers;

/// <summary>
/// Alta, edición y baja de productos (solo administrador).
/// Usa únicamente las tablas y columnas que ya existen:
///   · la imagen se guarda como archivo en wwwroot/uploads/productos y su ruta va en producto.imagen_url
///   · "eliminar" borra de verdad si el producto nunca se usó; si tiene ventas o ajustes lo desactiva (estado = 0)
///   · si cambia el stock se deja constancia en ajuste_inventario
/// </summary>
[ApiController]
[Authorize(Roles = "admin")]
[Route("api/admin/productos")]
public class ProductosAdminController(Db db, IWebHostEnvironment env) : ControllerBase
{
    private const long MaxImagen = 3 * 1024 * 1024;       // 3 MB
    private const decimal MaxDecimal = 99_999_999.99m;     // DECIMAL(10,2)
    private const string CarpetaUrl = "/uploads/productos/";

    private int UserId => int.Parse(User.FindFirstValue("uid")!);
    private string? Ip => HttpContext.Connection.RemoteIpAddress?.ToString();

    // Misma carpeta que crea y sirve Program.cs
    private string CarpetaFisica => Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "productos");

    private const string SelectProducto = """
        SELECT p.id_producto, p.codigo_barras, p.nombre, p.id_categoria, c.nombre AS categoria,
               p.precio_compra, p.precio_venta, p.stock_actual, p.stock_minimo, p.unidad_medida,
               p.imagen_url, p.origen, p.calorias, p.estado
        FROM producto p
        JOIN categoria c ON c.id_categoria = p.id_categoria
        """;

    // ------------------------------------------------------------
    // Listado completo (incluye desactivados y precio de compra)
    // ------------------------------------------------------------
    [HttpGet]
    public async Task<IActionResult> Listar()
    {
        using var cn = await db.OpenAsync();
        var data = await cn.QueryAsync<ProductoAdmin>(SelectProducto + " ORDER BY p.estado DESC, p.nombre");
        return Ok(data);
    }

    // ------------------------------------------------------------
    // Crear
    // ------------------------------------------------------------
    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Crear([FromForm] ProductoForm f)
    {
        var error = Validar(f);
        if (error is not null) return BadRequest(new { error });

        var (datos, ext, errorImagen) = await ObtenerImagen(f);
        if (errorImagen is not null) return BadRequest(new { error = errorImagen });

        var codigo = f.CodigoBarras!.Trim();
        using var cn = await db.OpenAsync();

        var dup = await cn.QueryFirstOrDefaultAsync<CodigoRow>(
            "SELECT id_producto, nombre, estado FROM producto WHERE codigo_barras = @codigo", new { codigo });
        if (dup is not null)
            return Conflict(new { error = MensajeDuplicado(dup) });

        var catOk = await cn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM categoria WHERE id_categoria = @id AND estado = 1", new { id = f.IdCategoria });
        if (catOk == 0) return BadRequest(new { error = "La categoría elegida no existe o está desactivada." });

        string? url = null;
        if (datos is not null) url = await GuardarImagen(datos, ext!);

        try
        {
            using var tx = cn.BeginTransaction();

            var id = await cn.QuerySingleAsync<int>("""
                INSERT INTO producto (codigo_barras, nombre, id_categoria, precio_compra, precio_venta,
                                      stock_actual, stock_minimo, unidad_medida, imagen_url, origen, calorias)
                OUTPUT inserted.id_producto
                VALUES (@codigo, @nombre, @cat, @compra, @venta, @stock, @minimo, @unidad, @url, @origen, @cal)
                """, Parametros(f, codigo, url), tx);

            await Auditoria.LogAsync(cn, tx, UserId, "CREAR_PRODUCTO", "producto", id,
                $"{f.Nombre!.Trim()} ({codigo})", Ip);

            tx.Commit();
            return Ok(await Obtener(cn, id));
        }
        catch (SqlException ex) when (ex.Number is 2627 or 2601)
        {
            BorrarImagenSubida(url);
            return Conflict(new { error = "Ya existe un producto con ese código de barras." });
        }
        catch
        {
            BorrarImagenSubida(url);
            throw;
        }
    }

    // ------------------------------------------------------------
    // Editar
    // ------------------------------------------------------------
    [HttpPut("{id:int}")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> Editar(int id, [FromForm] ProductoForm f)
    {
        var error = Validar(f);
        if (error is not null) return BadRequest(new { error });

        var (datos, ext, errorImagen) = await ObtenerImagen(f);
        if (errorImagen is not null) return BadRequest(new { error = errorImagen });

        var codigo = f.CodigoBarras!.Trim();
        using var cn = await db.OpenAsync();

        string? urlNueva = null;
        string? urlAnterior = null;

        try
        {
            using var tx = cn.BeginTransaction();

            // Bloquea la fila para que una venta simultánea no cambie el stock a mitad de la edición
            var actual = await cn.QuerySingleOrDefaultAsync<ProductoActualRow>("""
                SELECT nombre, stock_actual, imagen_url, estado
                FROM producto WITH (UPDLOCK, ROWLOCK)
                WHERE id_producto = @id
                """, new { id }, tx);
            if (actual is null) return NotFound(new { error = "El producto ya no existe." });

            var dup = await cn.QueryFirstOrDefaultAsync<CodigoRow>(
                "SELECT id_producto, nombre, estado FROM producto WHERE codigo_barras = @codigo AND id_producto <> @id",
                new { codigo, id }, tx);
            if (dup is not null) return Conflict(new { error = MensajeDuplicado(dup) });

            var catOk = await cn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM categoria WHERE id_categoria = @id", new { id = f.IdCategoria }, tx);
            if (catOk == 0) return BadRequest(new { error = "La categoría elegida no existe." });

            // Imagen: nueva, quitada o sin cambios
            urlAnterior = actual.ImagenUrl;
            var url = actual.ImagenUrl;
            if (datos is not null)
            {
                urlNueva = await GuardarImagen(datos, ext!);
                url = urlNueva;
            }
            else if (f.QuitarImagen)
            {
                url = null;
            }

            await cn.ExecuteAsync("""
                UPDATE producto
                SET codigo_barras = @codigo, nombre = @nombre, id_categoria = @cat,
                    precio_compra = @compra, precio_venta = @venta,
                    stock_actual = @stock, stock_minimo = @minimo, unidad_medida = @unidad,
                    imagen_url = @url, origen = @origen, calorias = @cal
                WHERE id_producto = @id
                """, Parametros(f, codigo, url, id), tx);

            // Si el stock cambió, queda registrado como ajuste de inventario
            var stockNuevo = Math.Round(f.StockActual!.Value, 2);
            if (stockNuevo != actual.StockActual)
            {
                await cn.ExecuteAsync("""
                    INSERT INTO ajuste_inventario (id_producto, id_usuario, cantidad_antes, cantidad_despues, diferencia, motivo)
                    VALUES (@id, @uid, @antes, @despues, @dif, @motivo)
                    """, new
                {
                    id,
                    uid = UserId,
                    antes = actual.StockActual,
                    despues = stockNuevo,
                    dif = stockNuevo - actual.StockActual,
                    motivo = "Edición desde el panel de administración"
                }, tx);
            }

            await Auditoria.LogAsync(cn, tx, UserId, "EDITAR_PRODUCTO", "producto", id,
                $"{f.Nombre!.Trim()} ({codigo})", Ip);

            tx.Commit();
        }
        catch (SqlException ex) when (ex.Number is 2627 or 2601)
        {
            BorrarImagenSubida(urlNueva);
            return Conflict(new { error = "Ya existe un producto con ese código de barras." });
        }
        catch
        {
            BorrarImagenSubida(urlNueva);
            throw;
        }

        // La imagen anterior solo se borra cuando el cambio ya quedó guardado
        if (urlNueva is not null || f.QuitarImagen)
            BorrarImagenSubida(urlAnterior);

        return Ok(await Obtener(cn, id));
    }

    // ------------------------------------------------------------
    // Eliminar: borra si nunca se usó; si tiene historial, lo desactiva
    // ------------------------------------------------------------
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        using var cn = await db.OpenAsync();
        using var tx = cn.BeginTransaction();

        var p = await cn.QuerySingleOrDefaultAsync<ProductoActualRow>("""
            SELECT nombre, stock_actual, imagen_url, estado
            FROM producto WITH (UPDLOCK, ROWLOCK)
            WHERE id_producto = @id
            """, new { id }, tx);
        if (p is null) return NotFound(new { error = "El producto ya no existe." });

        var conHistorial = await cn.ExecuteScalarAsync<int>("""
            SELECT CASE WHEN EXISTS (SELECT 1 FROM detalle_venta WHERE id_producto = @id)
                          OR EXISTS (SELECT 1 FROM ajuste_inventario WHERE id_producto = @id)
                        THEN 1 ELSE 0 END
            """, new { id }, tx) == 1;

        if (conHistorial)
        {
            if (!p.Estado) return Conflict(new { error = "El producto ya estaba desactivado." });

            await cn.ExecuteAsync("UPDATE producto SET estado = 0 WHERE id_producto = @id", new { id }, tx);
            await Auditoria.LogAsync(cn, tx, UserId, "DESACTIVAR_PRODUCTO", "producto", id, p.Nombre, Ip);
            tx.Commit();

            return Ok(new
            {
                eliminado = false,
                desactivado = true,
                mensaje = $"\"{p.Nombre}\" tiene ventas o ajustes registrados, así que se desactivó (ya no aparece en caja) para conservar el historial."
            });
        }

        await cn.ExecuteAsync("DELETE FROM producto WHERE id_producto = @id", new { id }, tx);
        await Auditoria.LogAsync(cn, tx, UserId, "ELIMINAR_PRODUCTO", "producto", id, p.Nombre, Ip);
        tx.Commit();

        BorrarImagenSubida(p.ImagenUrl);
        return Ok(new { eliminado = true, desactivado = false, mensaje = $"\"{p.Nombre}\" se eliminó." });
    }

    // ------------------------------------------------------------
    // Reactivar un producto desactivado
    // ------------------------------------------------------------
    [HttpPost("{id:int}/reactivar")]
    public async Task<IActionResult> Reactivar(int id)
    {
        using var cn = await db.OpenAsync();
        using var tx = cn.BeginTransaction();

        var filas = await cn.ExecuteAsync(
            "UPDATE producto SET estado = 1 WHERE id_producto = @id AND estado = 0", new { id }, tx);
        if (filas == 0) return NotFound(new { error = "El producto no existe o ya está activo." });

        await Auditoria.LogAsync(cn, tx, UserId, "REACTIVAR_PRODUCTO", "producto", id, null, Ip);
        tx.Commit();

        return Ok(await Obtener(cn, id));
    }

    // ============================================================
    // Auxiliares
    // ============================================================
    private static Task<ProductoAdmin?> Obtener(SqlConnection cn, int id) =>
        cn.QuerySingleOrDefaultAsync<ProductoAdmin>(SelectProducto + " WHERE p.id_producto = @id", new { id });

    private static string MensajeDuplicado(CodigoRow d) => d.Estado
        ? $"Ya existe un producto con ese código de barras ({d.Nombre})."
        : $"Ese código pertenece a un producto desactivado ({d.Nombre}). Reactívalo desde la lista.";

    private static object Parametros(ProductoForm f, string codigo, string? url, int? id = null) => new
    {
        id,
        codigo,
        nombre = f.Nombre!.Trim(),
        cat = f.IdCategoria,
        compra = Math.Round(f.PrecioCompra!.Value, 2),
        venta = Math.Round(f.PrecioVenta!.Value, 2),
        stock = Math.Round(f.StockActual!.Value, 2),
        minimo = Math.Round(f.StockMinimo!.Value, 2),
        unidad = f.UnidadMedida!.Trim(),
        url,
        origen = string.IsNullOrWhiteSpace(f.Origen) ? null : f.Origen.Trim(),
        cal = f.Calorias
    };

    private static string? Validar(ProductoForm f)
    {
        if (string.IsNullOrWhiteSpace(f.CodigoBarras)) return "Ingresa el código de barras.";
        if (f.CodigoBarras.Trim().Length > 30) return "El código de barras admite máximo 30 caracteres.";
        if (string.IsNullOrWhiteSpace(f.Nombre)) return "Ingresa el nombre del producto.";
        if (f.Nombre.Trim().Length > 100) return "El nombre admite máximo 100 caracteres.";
        if (f.IdCategoria is null) return "Elige una categoría.";
        if (f.PrecioCompra is null or < 0 or > MaxDecimal) return "El precio de compra no es válido.";
        if (f.PrecioVenta is null or < 0 or > MaxDecimal) return "El precio de venta no es válido.";
        if (f.StockActual is null or < 0 or > MaxDecimal) return "El stock actual no es válido.";
        if (f.StockMinimo is null or < 0 or > MaxDecimal) return "El stock mínimo no es válido.";
        if (string.IsNullOrWhiteSpace(f.UnidadMedida)) return "Elige la unidad de medida.";
        if (f.UnidadMedida.Trim().Length > 20) return "La unidad de medida admite máximo 20 caracteres.";
        if (f.Origen is not null && f.Origen.Trim().Length > 60) return "El origen admite máximo 60 caracteres.";
        if (f.Calorias is < 0) return "Las calorías no pueden ser negativas.";
        return null;
    }

    // ------------------------------------------------------------
    // Imagen: llega como archivo (desde el PC) o como URL de la web.
    // En ambos casos se comprueba el tipo real por su cabecera y se guarda con nombre propio.
    // ------------------------------------------------------------
    private static async Task<(byte[]? Datos, string? Ext, string? Error)> ObtenerImagen(ProductoForm f)
    {
        if (f.Imagen is not null)
        {
            if (f.Imagen.Length == 0) return (null, null, "El archivo de imagen está vacío.");
            if (f.Imagen.Length > MaxImagen) return (null, null, "La imagen supera los 3 MB.");
            using var ms = new MemoryStream();
            await f.Imagen.CopyToAsync(ms);
            return VerificarImagen(ms.ToArray());
        }

        if (!string.IsNullOrWhiteSpace(f.ImagenWeb))
            return await DescargarImagen(f.ImagenWeb.Trim());

        return (null, null, null);   // sin imagen nueva
    }

    private static (byte[]? Datos, string? Ext, string? Error) VerificarImagen(byte[] d)
    {
        if (d.Length >= 3 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF) return (d, ".jpg", null);
        if (d.Length >= 8 && d[0] == 0x89 && d[1] == 0x50 && d[2] == 0x4E && d[3] == 0x47
                          && d[4] == 0x0D && d[5] == 0x0A && d[6] == 0x1A && d[7] == 0x0A) return (d, ".png", null);
        if (d.Length >= 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                           && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return (d, ".webp", null);

        return (null, null, "Formato de imagen no válido. Usa JPG, PNG o WEBP.");
    }

    private static async Task<(byte[]? Datos, string? Ext, string? Error)> DescargarImagen(string texto)
    {
        if (texto.Length > 2000 || !Uri.TryCreate(texto, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return (null, null, "La URL de la imagen no es válida (debe empezar por http:// o https://).");

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            req.Headers.UserAgent.ParseAdd("Mozilla/5.0 (compatible; TesSupermarket/1.0)");
            req.Headers.Accept.ParseAdd("image/*");

            using var res = await Descargas.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            if (!res.IsSuccessStatusCode)
                return (null, null, $"No se pudo descargar la imagen (el sitio respondió {(int)res.StatusCode}).");
            if (res.Content.Headers.ContentLength > MaxImagen)
                return (null, null, "La imagen supera los 3 MB.");

            await using var s = await res.Content.ReadAsStreamAsync(cts.Token);
            using var ms = new MemoryStream();
            var buffer = new byte[81920];
            int n;
            while ((n = await s.ReadAsync(buffer, cts.Token)) > 0)
            {
                ms.Write(buffer, 0, n);
                if (ms.Length > MaxImagen) return (null, null, "La imagen supera los 3 MB.");
            }
            return VerificarImagen(ms.ToArray());
        }
        catch (OperationCanceledException)
        {
            return (null, null, "La descarga de la imagen tardó demasiado.");
        }
        catch (HttpRequestException)
        {
            return (null, null, "No se pudo descargar la imagen. Revisa que la URL sea pública y vaya directo a la imagen (JPG, PNG o WEBP).");
        }
    }

    /// <summary>
    /// Cliente para bajar imágenes de la web. Como la URL la escribe una persona, solo se conecta a
    /// direcciones públicas: así no se puede usar el servidor para llegar a la red interna o a localhost.
    /// </summary>
    private static readonly HttpClient Descargas = new(new SocketsHttpHandler
    {
        UseProxy = false,
        AllowAutoRedirect = true,
        MaxAutomaticRedirections = 3,
        ConnectCallback = async (contexto, ct) =>
        {
            var ips = await Dns.GetHostAddressesAsync(contexto.DnsEndPoint.Host, ct);
            var ip = ips.FirstOrDefault(EsIpPublica)
                     ?? throw new HttpRequestException("Dirección no permitida.");

            var socket = new Socket(ip.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try
            {
                await socket.ConnectAsync(new IPEndPoint(ip, contexto.DnsEndPoint.Port), ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        }
    })
    { Timeout = TimeSpan.FromSeconds(20) };

    private static bool EsIpPublica(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any)) return false;

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            return !(ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast || ip.IsIPv6UniqueLocal);

        var b = ip.GetAddressBytes();
        return !(b[0] == 0 || b[0] == 10 || b[0] == 127 || b[0] >= 224
              || (b[0] == 100 && b[1] >= 64 && b[1] <= 127)      // CGNAT
              || (b[0] == 169 && b[1] == 254)                    // link-local
              || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
              || (b[0] == 192 && b[1] == 168));
    }

    private async Task<string> GuardarImagen(byte[] datos, string ext)
    {
        Directory.CreateDirectory(CarpetaFisica);
        var nombre = $"{Guid.NewGuid():N}{ext}";   // nombre propio: el del usuario nunca se usa
        await System.IO.File.WriteAllBytesAsync(Path.Combine(CarpetaFisica, nombre), datos);
        return CarpetaUrl + nombre;
    }

    /// <summary>Solo borra archivos subidos desde el panel; las imágenes de frontend/public/productos no se tocan.</summary>
    private void BorrarImagenSubida(string? url)
    {
        if (string.IsNullOrEmpty(url) || !url.StartsWith(CarpetaUrl, StringComparison.Ordinal)) return;
        var ruta = Path.Combine(CarpetaFisica, Path.GetFileName(url));
        try { if (System.IO.File.Exists(ruta)) System.IO.File.Delete(ruta); }
        catch { /* borrar el archivo es secundario: no debe romper la operación */ }
    }
}
