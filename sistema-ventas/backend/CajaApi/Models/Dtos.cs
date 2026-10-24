namespace CajaApi.Models;

// ---------- Peticiones ----------
public record LoginRequest(string Usuario, string Password);
public record ItemRequest(int IdProducto, decimal Cantidad);
/// <summary>
/// ClaveIdempotencia: GUID que genera el navegador por cada venta. Si la petición se repite
/// (reintento tras un failover) la API devuelve la venta ya registrada en vez de cobrar dos veces.
/// </summary>
public record VentaRequest(string TipoPago, List<ItemRequest> Items, Guid? ClaveIdempotencia = null);

/// <summary>Formulario (multipart) para crear/editar un producto. Todo opcional: se valida a mano para dar mensajes claros.</summary>
public class ProductoForm
{
    public string? CodigoBarras { get; set; }
    public string? Nombre { get; set; }
    public int? IdCategoria { get; set; }
    public decimal? PrecioCompra { get; set; }
    public decimal? PrecioVenta { get; set; }
    public decimal? StockActual { get; set; }
    public decimal? StockMinimo { get; set; }
    public string? UnidadMedida { get; set; }
    public string? Origen { get; set; }
    public int? Calorias { get; set; }
    public bool QuitarImagen { get; set; }
    public IFormFile? Imagen { get; set; }
    /// <summary>URL pública de una imagen de la web; el servidor la descarga y la guarda como archivo propio.</summary>
    public string? ImagenWeb { get; set; }
}

// ---------- Filas / respuestas ----------
public class UsuarioRow
{
    public int IdUsuario { get; set; }
    public string NombreUsuario { get; set; } = "";
    public string ContrasenaHash { get; set; } = "";
    public string Rol { get; set; } = "";
    public bool Estado { get; set; }
    public string NombreCompleto { get; set; } = "";
    public bool EmpleadoActivo { get; set; }
}

public class Categoria
{
    public int IdCategoria { get; set; }
    public string Nombre { get; set; } = "";
    public string? Descripcion { get; set; }
}

public class Producto
{
    public int IdProducto { get; set; }
    public string CodigoBarras { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int IdCategoria { get; set; }
    public string Categoria { get; set; } = "";
    public decimal PrecioVenta { get; set; }
    public decimal StockActual { get; set; }
    public decimal StockMinimo { get; set; }
    public string UnidadMedida { get; set; } = "";
    public string? ImagenUrl { get; set; }
    public string? Origen { get; set; }
    public int? Calorias { get; set; }
}

/// <summary>Producto tal como lo ve el administrador (incluye precio de compra y desactivados).</summary>
public class ProductoAdmin
{
    public int IdProducto { get; set; }
    public string CodigoBarras { get; set; } = "";
    public string Nombre { get; set; } = "";
    public int IdCategoria { get; set; }
    public string Categoria { get; set; } = "";
    public decimal PrecioCompra { get; set; }
    public decimal PrecioVenta { get; set; }
    public decimal StockActual { get; set; }
    public decimal StockMinimo { get; set; }
    public string UnidadMedida { get; set; } = "";
    public string? ImagenUrl { get; set; }
    public string? Origen { get; set; }
    public int? Calorias { get; set; }
    public bool Estado { get; set; }
}

public class ProductoActualRow
{
    public string Nombre { get; set; } = "";
    public decimal StockActual { get; set; }
    public string? ImagenUrl { get; set; }
    public bool Estado { get; set; }
}

public class CodigoRow
{
    public int IdProducto { get; set; }
    public string Nombre { get; set; } = "";
    public bool Estado { get; set; }
}

public class Turno
{
    public int IdTurno { get; set; }
    public string NombreTurno { get; set; } = "";
    public TimeSpan HoraInicio { get; set; }
    public TimeSpan HoraFin { get; set; }
}

public class LineaRow
{
    public string Nombre { get; set; } = "";
    public decimal PrecioVenta { get; set; }
}

public class StockRow
{
    public string Nombre { get; set; } = "";
    public decimal Stock { get; set; }
}

public class DetalleRow
{
    public int IdProducto { get; set; }
    public string Nombre { get; set; } = "";
    public string UnidadMedida { get; set; } = "";
    public decimal Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Subtotal { get; set; }
}

public class VentaRow
{
    public int IdVenta { get; set; }
    public int IdUsuario { get; set; }
    public DateTime FechaVenta { get; set; }
    public string TipoPago { get; set; } = "";
    public decimal Subtotal { get; set; }
    public decimal Impuesto { get; set; }
    public decimal Total { get; set; }
    public bool Estado { get; set; }
    public string NombreTurno { get; set; } = "";
    public string Cajero { get; set; } = "";
    public List<DetalleRow> Detalles { get; set; } = new();
}
