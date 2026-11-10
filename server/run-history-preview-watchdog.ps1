$ErrorActionPreference='Stop'
$previewRoot='C:\Users\desscartes\.codex\visualizations\2026\10\16\01a14366-c26f-7ce1-8349-8955156c47f5\local-video-lab'
$reportPath='D:\Apps\HorseRide\data\maintenance\history-preview-watchdog.json'
try {
 $python=Join-Path $previewRoot '.venv\Scripts\python.exe'
 if(-not (Test-Path -LiteralPath $python)){throw 'Preview runtime missing'}
 $out=Join-Path $previewRoot 'watchdog-task.log'
 $err=Join-Path $previewRoot 'watchdog-task-error.log'
 $process=Start-Process -FilePath $python -ArgumentList @('-u','ensure_film_worker.py') -WorkingDirectory $previewRoot -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -Wait -PassThru
 $state=Get-Content -LiteralPath (Join-Path $previewRoot 'preview-watchdog.json') -Raw | ConvertFrom-Json
 @{checkedAt=[datetime]::UtcNow.ToString('o');exitCode=$process.ExitCode;status=$state.status;publication='disabled';interactive=[Environment]::UserInteractive} | ConvertTo-Json | Set-Content -LiteralPath $reportPath -Encoding UTF8
} catch {
 @{checkedAt=[datetime]::UtcNow.ToString('o');status='watchdog_error';message=$_.Exception.Message;publication='disabled'} | ConvertTo-Json | Set-Content -LiteralPath $reportPath -Encoding UTF8
 # A preview error must never stop race-card publishing.
}
