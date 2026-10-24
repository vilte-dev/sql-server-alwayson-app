using CajaApi.Data;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace CajaApi.Controllers;

/// <summary>
/// Estado de la conexión con SQL Server. Pensado para las pruebas de failover:
/// muestra qué servidor del Availability Group está respondiendo en este momento.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/salud")]
public class SaludController(Db db) : ControllerBase
{
    private class SaludRow
    {
        public string Servidor { get; set; } = "";
        public string? Modo { get; set; }
        public bool? EsPrimario { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var inicio = DateTime.Now;
        try
        {
            using var cn = await db.OpenUnaVezAsync(ct);
            var r = await cn.QuerySingleAsync<SaludRow>(new CommandDefinition("""
                SELECT @@SERVERNAME AS servidor,
                       CAST(DATABASEPROPERTYEX(DB_NAME(), 'Updateability') AS NVARCHAR(20)) AS modo,
                       CAST(sys.fn_hadr_is_primary_replica(DB_NAME()) AS BIT) AS es_primario
                """, commandTimeout: 5, cancellationToken: ct));

            return Ok(new
            {
                ok = true,
                servidor = r.Servidor,        // nodo que atiende ahora (cambia tras el failover)
                modo = r.Modo,                // READ_WRITE en el primario
                esPrimario = r.EsPrimario,    // null si la BD no está en un AG
                hora = DateTime.Now,
                msRespuesta = (int)(DateTime.Now - inicio).TotalMilliseconds
            });
        }
        catch (Exception ex) when (ex is SqlException or InvalidOperationException or TimeoutException)
        {
            return StatusCode(503, new { ok = false, error = ex.Message, hora = DateTime.Now });
        }
    }
}
