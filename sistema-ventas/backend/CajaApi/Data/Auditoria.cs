using Dapper;
using Microsoft.Data.SqlClient;

namespace CajaApi.Data;

public static class Auditoria
{
    public static Task LogAsync(SqlConnection cn, SqlTransaction? tx, int idUsuario, string accion,
                                string? tabla, int? idRegistro, string? detalle, string? ip) =>
        cn.ExecuteAsync("""
            INSERT INTO auditoria (id_usuario, accion, tabla_afectada, id_registro, detalle, direccion_ip)
            VALUES (@idUsuario, @accion, @tabla, @idRegistro, @detalle, @ip)
            """, new { idUsuario, accion, tabla, idRegistro, detalle, ip }, tx);
}
