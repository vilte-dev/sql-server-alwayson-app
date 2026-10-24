using CajaApi.Models;
using Dapper;
using Microsoft.Data.SqlClient;

namespace CajaApi.Services;

public static class Turnos
{
    /// <summary>Turno activo según la hora actual (soporta turnos que cruzan la medianoche).</summary>
    public static Task<Turno?> ActualAsync(SqlConnection cn, SqlTransaction? tx = null) =>
        cn.QueryFirstOrDefaultAsync<Turno>("""
            SELECT TOP 1 id_turno, nombre_turno, hora_inicio, hora_fin
            FROM turno
            WHERE estado = 1 AND (
                  (hora_inicio < hora_fin AND @Ahora >= hora_inicio AND @Ahora < hora_fin)
               OR (hora_inicio > hora_fin AND (@Ahora >= hora_inicio OR @Ahora < hora_fin)))
            ORDER BY id_turno
            """, new { Ahora = DateTime.Now.TimeOfDay }, tx);
}
