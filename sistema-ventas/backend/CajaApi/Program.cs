using System.Globalization;
using System.Text;
using CajaApi.Data;
using CajaApi.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

// Los decimales del formulario de productos llegan con punto (12.50); así se leen igual
// aunque el Windows del servidor esté configurado con coma decimal (es-BO, es-ES...).
CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

// Permite mapear columnas snake_case (id_producto) a propiedades PascalCase (IdProducto)
Dapper.DefaultTypeMap.MatchNamesWithUnderscores = true;

var builder = WebApplication.CreateBuilder(args);

// Carpeta de imágenes subidas. Se crea aquí (no depende de que exista wwwroot al arrancar)
// y la usa tanto la API para guardar como el servidor de archivos estáticos para entregar.
var carpetaImagenes = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads", "productos");
Directory.CreateDirectory(carpetaImagenes);

builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddControllers();

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

var jwt = builder.Configuration.GetSection("Jwt");
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // conserva los nombres cortos: uid, name, role
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt["Issuer"],
            ValidateAudience = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
            NameClaimType = "name",
            RoleClaimType = "role"
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Manejo global de errores: si SQL Server no responde (failover del Availability Group, red caída...)
// devuelve 503 con un mensaje claro en vez de un 500 genérico. El frontend reintenta al ver un 503.
app.UseExceptionHandler(errores => errores.Run(async ctx =>
{
    var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
    var log = ctx.RequestServices.GetRequiredService<ILogger<Program>>();

    if (SqlTransitorio.Es(ex))
    {
        log.LogWarning(ex, "SQL Server no disponible durante {Metodo} {Ruta}", ctx.Request.Method, ctx.Request.Path);
        ctx.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        ctx.Response.Headers["Retry-After"] = "10";
        await ctx.Response.WriteAsJsonAsync(new { error = "La base de datos no está disponible en este momento (posible cambio de servidor). Reintenta en unos segundos." });
        return;
    }

    log.LogError(ex, "Error no controlado en {Metodo} {Ruta}", ctx.Request.Method, ctx.Request.Path);
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await ctx.Response.WriteAsJsonAsync(new { error = "Error interno del servidor." });
}));

// Crea los usuarios admin y cajero la primera vez (si la tabla está vacía).
// Si la BD no está disponible al arrancar (p. ej. en pleno failover) la API NO se cae:
// avisa en el log y sigue; los usuarios se crearán en el próximo arranque.
try
{
    await Seeder.RunAsync(app.Services.GetRequiredService<Db>());
}
catch (SqlException ex)
{
    app.Logger.LogWarning(ex, "No se pudo comprobar/crear los usuarios iniciales (SQL Server no disponible). La API arranca igual.");
}

// Imágenes subidas por el administrador. Se sirven en /uploads/productos y también bajo /api/uploads/productos
// (esta segunda ruta siempre pasa por el proxy de Vite, así que funciona aunque no se haya reiniciado el frontend).
var proveedorImagenes = new PhysicalFileProvider(carpetaImagenes);
app.UseStaticFiles(new StaticFileOptions { FileProvider = proveedorImagenes, RequestPath = "/uploads/productos" });
app.UseStaticFiles(new StaticFileOptions { FileProvider = proveedorImagenes, RequestPath = "/api/uploads/productos" });
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
