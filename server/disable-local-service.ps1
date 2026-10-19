$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$lock=Join-Path $root 'data\maintenance\supervisor.lock'
if(Test-Path -LiteralPath $lock){
 $owner=Get-Content -LiteralPath $lock -Raw | ConvertFrom-Json
 $process=Get-CimInstance Win32_Process -Filter ("ProcessId="+[int]$owner.pid)
 if($process){
  if($process.Name -ne 'node.exe' -or $process.CommandLine -notlike ('*'+$root+'\server\service-supervisor.mjs*')){throw 'Process ownership could not be verified.'}
  & taskkill.exe /PID $owner.pid /T /F
  if($LASTEXITCODE -ne 0){throw 'Service could not be stopped.'}
 }
 if(Test-Path -LiteralPath $lock){
  $current=Get-Content -LiteralPath $lock -Raw | ConvertFrom-Json
  if($current.pid -eq $owner.pid){Remove-Item -LiteralPath $lock}
 }
}
$task=Get-ScheduledTask -TaskName 'GanyanZekasi-Service' -ErrorAction SilentlyContinue
if($task -and ($task.Actions.Arguments -like ('*'+$root+'*'))){$task | Disable-ScheduledTask | Out-Null}
Write-Output 'Local supervisor stopped. The home server continues independently.'
