using Microsoft.Data.SqlClient;

namespace CajaApi.Data;

public class Db
{
    private const int MaxIntentos = 4;

    private readonly string _cs;
    private readonly ILogger<Db> _log;

    public Db(IConfiguration config, ILogger<Db> log)
    {
        _log = log;
        _cs = config.GetConnectionString("Default")
              ?? throw new InvalidOperationException("Falta ConnectionStrings:Default en appsettings.json");
    }

    /// <summary>
    /// Abre una conexión. Si el servidor no responde por un error temporal (failover del
    /// Availability Group, red, BD en recuperación) espera y reintenta antes de rendirse.
    /// </summary>
    public async Task<SqlConnection> OpenAsync(CancellationToken ct = default)
    {
        for (var intento = 1; ; intento++)
        {
            var cn = new SqlConnection(_cs);
            try
            {
                await cn.OpenAsync(ct);
                if (intento > 1) _log.LogInformation("Conexión a SQL Server recuperada en el intento {Intento}.", intento);
                return cn;
            }
            catch (SqlException ex) when (SqlTransitorio.Es(ex) && intento < MaxIntentos)
            {
                await cn.DisposeAsync();
                var espera = TimeSpan.FromSeconds(intento * 3);
                _log.LogWarning("SQL Server no disponible (error {Numero}: {Mensaje}). Reintento {Intento}/{Max} en {Seg}s...",
                    ex.Number, ex.Message, intento, MaxIntentos - 1, espera.TotalSeconds);
                SqlConnection.ClearAllPools();   // descarta conexiones muertas hacia el antiguo primario
                await Task.Delay(espera, ct);
            }
            catch
            {
                await cn.DisposeAsync();
                throw;
            }
        }
    }

    /// <summary>Un solo intento, sin esperas: para el endpoint de salud, que debe mostrar el estado real.</summary>
    public async Task<SqlConnection> OpenUnaVezAsync(CancellationToken ct = default)
    {
        var cn = new SqlConnection(_cs);
        try { await cn.OpenAsync(ct); return cn; }
        catch { await cn.DisposeAsync(); throw; }
    }
}
