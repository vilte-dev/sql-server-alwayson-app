using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace CajaApi.Services;

public class TokenService
{
    private readonly SigningCredentials _creds;
    private readonly string _issuer;
    private readonly int _minutos;

    public TokenService(IConfiguration config)
    {
        var jwt = config.GetSection("Jwt");
        _creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            SecurityAlgorithms.HmacSha256);
        _issuer = jwt["Issuer"]!;
        _minutos = int.TryParse(jwt["Minutos"], out var m) ? m : 480;
    }

    public string Crear(int idUsuario, string nombre, string rol)
    {
        var claims = new[]
        {
            new Claim("uid", idUsuario.ToString()),
            new Claim("name", nombre),
            new Claim("role", rol)
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(_minutos),
            signingCredentials: _creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
