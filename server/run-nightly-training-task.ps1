$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$day = Get-Date -Format 'yyyy-MM-dd'
$statePath = Join-Path $root 'data\maintenance\state.json'
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.day -eq $day -and $state.finishedAt) { return }
}
$lockPath = Join-Path $root 'data\maintenance\daily.lock'
if (Test-Path -LiteralPath $lockPath) {
    $owner = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    if ($owner.pid -and (Get-Process -Id ([int]$owner.pid) -ErrorAction SilentlyContinue)) { return }
}
$node = 'D:\Tools\node-v24.15.0-win-x64\node.exe'
$log = Join-Path $root ("data\maintenance\nightly-training-{0}.log" -f $day)
Set-Location -LiteralPath $root
& $node --use-system-ca 'server/daily-maintenance.mjs' *>> $log
exit $LASTEXITCODE
