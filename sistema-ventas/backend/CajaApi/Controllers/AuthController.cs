using System.Security.Claims;
using CajaApi.Data;
using CajaApi.Models;
using CajaApi.Services;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CajaApi.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(Db db, TokenService tokens) : ControllerBase
{
    private string? Ip => HttpContext.Connection.RemoteIpAddress?.ToString();

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Usuario) || string.IsNullOrEmpty(req.Password))
            return BadRequest(new { error = "Ingresa usuario y contraseña." });

        using var cn = await db.OpenAsync();

        var u = await cn.QuerySingleOrDefaultAsync<UsuarioRow>("""
            SELECT u.id_usuario, u.nombre_usuario, u.contrasena_hash, u.rol, u.estado,
                   e.nombres + ' ' + e.apellidos AS nombre_completo,
                   e.estado AS empleado_activo
            FROM usuario_sistema u
            JOIN empleado e ON e.id_empleado = u.id_empleado
            WHERE u.nombre_usuario = @Usuario
            """, new { Usuario = req.Usuario.Trim() });

        var credencialesOk = u is not null && BCrypt.Net.BCrypt.Verify(req.Password, u.ContrasenaHash);

        if (!credencialesOk)
        {
            if (u is not null)
                await Auditoria.LogAsync(cn, null, u.IdUsuario, "LOGIN_FALLIDO", "usuario_sistema", u.IdUsuario, null, Ip);
            return Unauthorized(new { error = "Usuario o contraseña incorrectos." });
        }

        if (!u!.Estado || !u.EmpleadoActivo)
            return Unauthorized(new { error = "Este usuario está desactivado. Consulta con el administrador." });

        await cn.ExecuteAsync("UPDATE usuario_sistema SET ultimo_acceso = SYSDATETIME() WHERE id_usuario = @IdUsuario", new { u.IdUsuario });
        await Auditoria.LogAsync(cn, null, u.IdUsuario, "LOGIN", "usuario_sistema", u.IdUsuario, null, Ip);

        var token = tokens.Crear(u.IdUsuario, u.NombreCompleto, u.Rol);
        return Ok(new { token, usuario = new { id = u.IdUsuario, nombre = u.NombreCompleto, rol = u.Rol } });
    }

    [Authorize]
    [HttpGet("me")]
    public IActionResult Me() => Ok(new
    {
        id = int.Parse(User.FindFirstValue("uid")!),
        nombre = User.FindFirstValue("name"),
        rol = User.FindFirstValue("role")
    });
}
