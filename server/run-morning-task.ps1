$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$day = Get-Date -Format 'yyyy-MM-dd'
$reportPath = Join-Path $root ("data\maintenance\morning-{0}.json" -f $day)
if (Test-Path -LiteralPath $reportPath) {
    $report = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
    if ($report.day -eq $day -and $report.finishedAt) { return }
}
$node = 'D:\Tools\node-v24.15.0-win-x64\node.exe'
$log = Join-Path $root ("data\maintenance\morning-{0}-scheduled.log" -f $day)
Set-Location -LiteralPath $root
& $node --use-system-ca 'server/run-morning-preparation.mjs' *>> $log
exit $LASTEXITCODE
