$ErrorActionPreference='Stop'
Set-Location -LiteralPath 'D:\Apps\HorseRide'
$mutex=New-Object Threading.Mutex($false,'Local\HorseRidePublicWatchdog')
if(-not $mutex.WaitOne(0)){ $mutex.Dispose();exit 0 }
try {
 $metaPath='data/maintenance/alternate-public-processes.json'
 $meta=Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
 $cfg=Get-Content -LiteralPath 'data/maintenance/public-address.json' -Raw | ConvertFrom-Json
 $changes=@()
 try { $local=Invoke-RestMethod 'http://127.0.0.1:8793/api/health' -TimeoutSec 5 } catch { $local=$null }
 if(-not $local.ok){
  $listener=Get-NetTCPConnection -LocalPort 8793 -State Listen -ErrorAction SilentlyContinue
  if(-not $listener){
   $env:PUBLIC_PORT='8793'
   $g=Start-Process 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','D:\Apps\HorseRide\server\public-gateway.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\gateway-recovery.stdout.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\gateway-recovery.stderr.log' -PassThru
   $meta.gatewayPid=$g.Id;$changes+='gateway_started'
  }
 }
 $tunnel=Get-CimInstance Win32_Process -Filter "ProcessId=$($meta.tunnelPid)" -ErrorAction SilentlyContinue
 if(-not $tunnel -or ($tunnel.CommandLine -and $tunnel.CommandLine -notlike '*cloudflared*')){
  $t=Start-Process 'D:\Tools\cloudflared.exe' -ArgumentList 'tunnel','--url','http://127.0.0.1:8793','--no-autoupdate' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\tunnel-recovery.stdout.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\tunnel-recovery.stderr.log' -PassThru
  $meta.tunnelPid=$t.Id;$changes+='tunnel_started'
 }
 $log=Get-Content 'data/maintenance/tunnel-recovery.stderr.log' -Raw -ErrorAction SilentlyContinue
 $candidate=[regex]::Match([string]$log,'https://[a-z0-9-]+\.trycloudflare\.com').Value
 $stableUrl='https://ganyan-zekasi.tailab9792.ts.net'
 $stableHealthy=$false
 try{$stableHealth=Invoke-RestMethod ($stableUrl+'/api/health') -TimeoutSec 6;$stableHealthy=[bool]$stableHealth.ok}catch{}
 if($stableHealthy){$candidate=$stableUrl}
 $external=$null
 if($candidate){
  try{$external=Invoke-RestMethod ($candidate+'/api/health') -TimeoutSec 8}catch{}
  if($external.ok -and $candidate -ne $cfg.url){$cfg.previousUrl=$cfg.url;$cfg.url=$candidate;$cfg.provider=if($stableHealthy){'tailscale-funnel'}else{'cloudflare-quick-tunnel'};$cfg.temporary=(-not $stableHealthy);$cfg.verifiedAt=[DateTime]::UtcNow.ToString('o');$cfg | ConvertTo-Json | Set-Content 'data/maintenance/public-address.json' -Encoding UTF8;$changes+='verified_address_updated'}
 }
 $meta | ConvertTo-Json | Set-Content -LiteralPath $metaPath -Encoding UTF8
 @{checkedAt=[DateTime]::UtcNow.ToString('o');url=$cfg.url;externalOk=[bool]$external.ok;changes=$changes;automaticRecovery=$true;addressMayChange=(-not $stableHealthy);stableUrl=$stableUrl;stableHealthy=$stableHealthy} | ConvertTo-Json | Set-Content 'data/maintenance/public-watchdog.json' -Encoding UTF8
} finally { $mutex.ReleaseMutex();$mutex.Dispose() }
