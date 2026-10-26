$ErrorActionPreference='Stop'
$path=Join-Path $env:LOCALAPPDATA 'ngrok\horseride.yml'
if(-not(Test-Path -LiteralPath $path)){return @{configured=$false;ready=$false;reason='ngrok_account_setup_required'}}
$metaPath='data/maintenance/alternate-public-processes.json'
$meta=Get-Content -LiteralPath $metaPath -Raw | ConvertFrom-Json
$process=$null
if($meta.ngrokPid){$process=Get-CimInstance Win32_Process -Filter "ProcessId=$($meta.ngrokPid)" -ErrorAction SilentlyContinue}
if(-not $process){
 $matches=@(Get-CimInstance Win32_Process -Filter "Name='ngrok.exe'" | Where-Object {$_.CommandLine -match 'ngrok.+http.+8793' -and $_.CommandLine.Contains($path)})
 if($matches.Count -gt 1){return @{configured=$true;ready=$false;reason='multiple_ngrok_owners'}}
 if($matches.Count -eq 1){$process=$matches[0];$meta | Add-Member -NotePropertyName ngrokPid -NotePropertyValue $process.ProcessId -Force;$meta | ConvertTo-Json | Set-Content -LiteralPath $metaPath -Encoding UTF8}
}
if(-not $process -or ($process.CommandLine -and $process.CommandLine -notmatch 'ngrok.+http.+8793')){
 $ng=Start-Process 'D:\Tools\ngrok\ngrok.exe' -ArgumentList @('http','http://127.0.0.1:8793','--config',('"'+$path+'"'),'--log','stdout','--log-format','json') -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\ngrok.stdout.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\ngrok.stderr.log' -PassThru
 $meta | Add-Member -NotePropertyName ngrokPid -NotePropertyValue $ng.Id -Force
 $meta | ConvertTo-Json | Set-Content -LiteralPath $metaPath -Encoding UTF8
}
try{
 $inspection=Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 3
 $tunnel=$inspection.tunnels | Where-Object {$_.public_url -match '^https://[a-z0-9.-]+\.ngrok(?:-free)?\.(?:app|dev|io)$' -and $_.config.addr -match '127\.0\.0\.1:8793/?$'} | Select-Object -First 1
 if(-not $tunnel){return @{configured=$true;ready=$false;reason='waiting_for_ngrok_endpoint'}}
 $h=Invoke-RestMethod ($tunnel.public_url+'/api/health') -Headers @{'ngrok-skip-browser-warning'='1'} -TimeoutSec 8
 if(-not $h.ok -or $h.service -ne 'horseride-public'){throw 'Unexpected public service'}
 return @{configured=$true;ready=$true;url=$tunnel.public_url}
}catch{return @{configured=$true;ready=$false;reason='endpoint_not_verified'}}
