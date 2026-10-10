$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskLockPath = Join-Path $taskProjectRoot 'data\maintenance\supervisor.lock'
if (Test-Path -LiteralPath $taskLockPath) {
  $taskOwner = Get-Content -LiteralPath $taskLockPath -Raw | ConvertFrom-Json
  $taskProcess = Get-CimInstance Win32_Process -Filter ("ProcessId=" + [int]$taskOwner.pid)
  if ($taskProcess) {
    if ($taskProcess.Name -ne 'node.exe' -or $taskProcess.CommandLine -notlike ('*' + $taskProjectRoot + '\server\service-supervisor.mjs*')) { throw 'Kayitli PID bu projenin gozetmeni olarak dogrulanamadi; durdurulmadi.' }
    $taskChildren = Get-CimInstance Win32_Process -Filter ("ParentProcessId=" + [int]$taskOwner.pid)
    Stop-Process -Id ([int]$taskOwner.pid) -ErrorAction Stop
    foreach ($taskChild in $taskChildren) {
      if ($taskChild.Name -eq 'node.exe' -and $taskChild.CommandLine -match 'server[/\\](index|capture-prestart)\.mjs') { Stop-Process -Id $taskChild.ProcessId -ErrorAction SilentlyContinue }
    }
    if (Test-Path -LiteralPath $taskLockPath) {
      $taskCurrentOwner = Get-Content -LiteralPath $taskLockPath -Raw | ConvertFrom-Json
      if ($taskCurrentOwner.pid -eq $taskOwner.pid) { Remove-Item -LiteralPath $taskLockPath }
    }
  }
}
Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $taskProjectRoot 'Baslat-GanyanZekasi.vbs') + '"') -WindowStyle Hidden
Write-Output 'Ganyan Zekasi servisi yeni kodla baslatiliyor. Devam eden egitim sureci durdurulmaz.'
