$ErrorActionPreference = 'Stop'
$tailscale = 'C:\Program Files\Tailscale\tailscale.exe'
if (-not (Test-Path -LiteralPath $tailscale)) { throw 'Tailscale is not installed.' }
$status = (& $tailscale status --json | ConvertFrom-Json)
if ($status.BackendState -ne 'Running') { throw 'Authenticate the server with Tailscale before enabling Funnel.' }
$health = Invoke-RestMethod 'http://127.0.0.1:8790/api/health' -TimeoutSec 10
if (-not $health.ok) { throw 'Public gateway is not healthy.' }
& $tailscale set --unattended=true
if ($LASTEXITCODE -ne 0) { throw 'Could not enable unattended mode.' }
& $tailscale funnel --bg --yes http://127.0.0.1:8790
if ($LASTEXITCODE -ne 0) { throw 'Funnel requires account permissions; follow the URL printed by Tailscale.' }
& $tailscale funnel status
