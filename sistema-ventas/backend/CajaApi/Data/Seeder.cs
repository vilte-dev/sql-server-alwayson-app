using Dapper;

namespace CajaApi.Data;

/// <summary>
/// Si no existe ningún usuario, crea un administrador y un cajero de ejemplo
/// (cada usuario necesita un empleado, y la contraseña se guarda con BCrypt).
/// </summary>
public static class Seeder
{
    public static async Task RunAsync(Db db)
    {
        using var cn = await db.OpenAsync();

        var existentes = await cn.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM usuario_sistema");
        if (existentes > 0) return;

        async Task Crear(string ci, string nombres, string apellidos, string cargo,
                         string usuario, string password, string rol)
        {
            var idEmpleado = await cn.QuerySingleAsync<int>("""
                INSERT INTO empleado (ci, nombres, apellidos, cargo, area, fecha_contratacion, salario)
                OUTPUT inserted.id_empleado
                VALUES (@ci, @nombres, @apellidos, @cargo, N'Ventas', CAST(SYSDATETIME() AS DATE), 0)
                """, new { ci, nombres, apellidos, cargo });

            await cn.ExecuteAsync("""
                INSERT INTO usuario_sistema (id_empleado, nombre_usuario, contrasena_hash, rol)
                VALUES (@idEmpleado, @usuario, @hash, @rol)
                """, new { idEmpleado, usuario, hash = BCrypt.Net.BCrypt.HashPassword(password), rol });
        }

        await Crear("1000001", "Administrador", "General", "Administrador", "admin", "Admin123!", "admin");
        await Crear("1000002", "Carlos", "Cajero", "Cajero", "cajero", "Cajero123!", "cajero");

        Console.WriteLine("Usuarios iniciales creados: admin / Admin123!  y  cajero / Cajero123!");
    }
}
