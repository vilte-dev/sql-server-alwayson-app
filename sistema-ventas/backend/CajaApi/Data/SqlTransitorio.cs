using Microsoft.Data.SqlClient;

namespace CajaApi.Data;

/// <summary>
/// Reconoce los errores de SQL Server que aparecen mientras el Availability Group
/// hace un failover o la red se corta. Son errores "temporales": reintentar tiene sentido.
/// </summary>
public static class SqlTransitorio
{
    private static readonly HashSet<int> Codigos = new()
    {
        -2,     // timeout de la consulta / conexión
        53,     // no se encontró el servidor (red)
        64,     // la conexión se cerró durante el login
        233,    // no hay proceso en el otro extremo del canal
        258,    // timeout de espera del login
        976,    // BD de un AG no accesible (réplica secundaria no legible)
        983,    // BD no accesible: la réplica no está en rol PRIMARY ni SECONDARY
        4060,   // no se puede abrir la BD (en recuperación tras el failover)
        10053, 10054, 10060, 10061, // errores de red (conexión abortada / reiniciada / timeout / rechazada)
        35250,  // la conexión con el primario no está activa
        40613, 40197, 40501, 49918 // por si la BD se migra a Azure
    };

    public static bool Es(SqlException ex) =>
        ex.Errors.Cast<SqlError>().Any(e => Codigos.Contains(e.Number)) || Codigos.Contains(ex.Number);

    /// <summary>Busca un SqlException transitorio en la cadena de excepciones.</summary>
    public static bool Es(Exception? ex)
    {
        for (var e = ex; e is not null; e = e.InnerException)
            if (e is SqlException sql && Es(sql)) return true;
        return false;
    }
}
