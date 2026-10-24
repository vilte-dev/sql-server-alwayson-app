<#
  Monitor de failover: consulta /api/salud cada segundo y muestra qué servidor del
  Availability Group responde. Deja una línea por segundo y resume los cortes.

  Uso (con la API en marcha):
      .\probar-failover.ps1
      .\probar-failover.ps1 -Url http://localhost:5080/api/salud -Intervalo 1
  Mientras corre, fuerza el failover (apaga el nodo primario o usa SSMS) y observa el cambio.
  Detener con Ctrl+C.
#>
param(
    [string]$Url = "http://localhost:5080/api/salud",
    [double]$Intervalo = 1
)

$servidorAnterior = $null
$caidoDesde = $null
$cortes = @()

Write-Host "Monitoreando $Url  (Ctrl+C para salir)`n"

try {
    while ($true) {
        $hora = Get-Date -Format "HH:mm:ss"
        try {
            $r = Invoke-RestMethod -Uri $Url -TimeoutSec 8 -ErrorAction Stop
            if ($caidoDesde) {
                $seg = [math]::Round(((Get-Date) - $caidoDesde).TotalSeconds, 1)
                $cortes += $seg
                Write-Host "$hora  RECUPERADO tras $seg s sin servicio" -ForegroundColor Green
                $caidoDesde = $null
            }
            $cambio = ""
            if ($servidorAnterior -and $servidorAnterior -ne $r.servidor) {
                $cambio = "  <<< FAILOVER: $servidorAnterior -> $($r.servidor)"
            }
            $color = if ($cambio) { "Yellow" } else { "Gray" }
            Write-Host ("{0}  OK   servidor={1}  modo={2}  primario={3}  {4} ms{5}" -f $hora, $r.servidor, $r.modo, $r.esPrimario, $r.msRespuesta, $cambio) -ForegroundColor $color
            $servidorAnterior = $r.servidor
        }
        catch {
            if (-not $caidoDesde) { $caidoDesde = Get-Date }
            Write-Host "$hora  SIN SERVICIO  ($($_.Exception.Message))" -ForegroundColor Red
        }
        Start-Sleep -Milliseconds ([int]($Intervalo * 1000))
    }
}
finally {
    if ($cortes.Count) {
        Write-Host "`nResumen: $($cortes.Count) corte(s). Duración(es) en segundos: $($cortes -join ', ')"
    } else {
        Write-Host "`nResumen: no hubo cortes."
    }
}
