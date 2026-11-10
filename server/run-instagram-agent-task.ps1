$ErrorActionPreference='Stop'
trap {
  @{checkedAt=[datetime]::UtcNow.ToString('o');type=$_.Exception.GetType().Name;message=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber} | ConvertTo-Json | Set-Content -LiteralPath 'D:\Apps\HorseRide\data\maintenance\instagram-task-error.json' -Encoding UTF8
  exit 1
}
try{[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)}catch{}
$OutputEncoding=New-Object Text.UTF8Encoding($false)
$env:PYTHONUTF8='1'
$env:HORSERIDE_CHROMIUM_EXE='D:\Tools\HorseRideChromium\chrome-headless-shell.exe'
Set-Location -LiteralPath 'D:\Apps\HorseRide'
# PUBLICATION_DELIVERY_WATCHDOG: fixed existing tasks only; no direct publication, no visual auto-approval.
try { & 'D:\Tools\node-v24.15.0-win-x64\node.exe' 'D:\Apps\HorseRide\server\publication-watchdog.mjs' '--context=instagram-before' *> 'D:\Apps\HorseRide\data\maintenance\publication-watchdog-instagram-before.log' } catch { Write-Output 'Publication delivery audit failed; inspect local alarm.' }
$node='D:\Tools\node-v24.15.0-win-x64\node.exe'
$day=Get-Date -Format 'yyyy-MM-dd'
function Run-Node($arguments,$prefix){
  $p=Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput ($prefix+'.stdout.log') -RedirectStandardError ($prefix+'.stderr.log') -Wait -PassThru
  return $p.ExitCode
}
if(-not (Test-Path -LiteralPath 'data/maintenance/unattended-history-selfcheck.json')){
  $p=Start-Process -FilePath 'D:\Apps\HorseRide\.voice-venv\Scripts\python.exe' -ArgumentList 'server/history-selfcheck.py' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'data/maintenance/unattended-history-selfcheck.stdout.log' -RedirectStandardError 'data/maintenance/unattended-history-selfcheck.stderr.log' -Wait -PassThru
  # A video diagnostic failure must not stop ordinary race publications.
  if($p.ExitCode -ne 0){Write-Output ('History selfcheck failed: '+$p.ExitCode)}
}
$renderProbe='data/maintenance/unattended-render-probe.json'
if(-not (Test-Path -LiteralPath $renderProbe)){
  $renderExit=Run-Node @('--use-system-ca','server/instagram-news/render-race-cards.mjs',"data/program-cache/$day.json",'Bursa','data/maintenance/unattended-render-preview') 'data/maintenance/unattended-render-probe'
  @{checkedAt=[datetime]::UtcNow.ToString('o');exitCode=$renderExit} | ConvertTo-Json | Set-Content -LiteralPath $renderProbe -Encoding UTF8
}
$probe='data/maintenance/unattended-instagram-probe.json'
if(-not (Test-Path -LiteralPath $probe)){
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -ExecutionPolicy Bypass -File server/check-instagram-connection.ps1 *>> "data/instagram/credential-probe-$day.log"
  $connection=Get-Content data/maintenance/instagram-connection.json -Raw | ConvertFrom-Json
  if($LASTEXITCODE -ne 0 -or -not $connection.valid){exit 1}
  @{verifiedAt=[datetime]::UtcNow.ToString('o');account=$connection.account;dpapiGraphVerified=$true;identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;interactive=[Environment]::UserInteractive} | ConvertTo-Json | Set-Content -LiteralPath $probe -Encoding UTF8
}
# NATIVE_SPEECH_PROFILE_SETUP
try { & 'D:\Apps\HorseRide\server\complete-native-speech-setup.ps1' } catch { Write-Output 'Native speech profile setup failed; encrypted data retained for diagnosis.' }
# NATIVE_HISTORY_SELFCHECK: actual task identity/session proof; never publishes.
$nativeProbe='data/maintenance/unattended-native-history-selfcheck.json'
$nativeResult=$null
if(Test-Path -LiteralPath $nativeProbe){try{$nativeResult=Get-Content -LiteralPath $nativeProbe -Raw|ConvertFrom-Json}catch{}}
if(-not $nativeResult -or $nativeResult.status -ne 'passed' -or $nativeResult.rendererVersion -ne 'local-native-motion-v1' -or $nativeResult.interactive -ne $false){
  $nativeExit=Run-Node @('--use-system-ca','server/history-native-selfcheck.mjs') 'data/maintenance/native-history-selfcheck'
  if($nativeExit -eq 0){
    $nativeResult=Get-Content -LiteralPath $nativeProbe -Raw|ConvertFrom-Json
    $nativeResult|Add-Member -NotePropertyName interactive -NotePropertyValue ([Environment]::UserInteractive) -Force
    $nativeResult|Add-Member -NotePropertyName identity -NotePropertyValue ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -Force
    $nativeResult|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $nativeProbe -Encoding UTF8
  }else{Write-Output ('Native history selfcheck failed: '+$nativeExit)}
}
# TR_PUBLICATION_VERIFY_20261103: read-only proof through the real task account.
$trProof='data/maintenance/tr-publication-native-proof.json'
$trVerified=$false
if(Test-Path $trProof){try{$trVerified=(Get-Content $trProof -Raw|ConvertFrom-Json).verified}catch{}}
$trLedger='data/instagram/race-cards-2026-11-03-kocaeli/publication.json'
if(-not $trVerified -and (Test-Path $trLedger)){
 $trState=Get-Content $trLedger -Raw|ConvertFrom-Json
 if($trState.status -eq 'published_verified'){
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -ExecutionPolicy Bypass -File server/publish-instagram-introduction.ps1 -PublicationId race-cards-2026-11-03-kocaeli -Mode Verify *> data/maintenance/tr-publication-native-verify.log
  @{verified=($LASTEXITCODE -eq 0);interactive=[Environment]::UserInteractive;checkedAt=[datetime]::UtcNow.ToString('o');permalink=$trState.permalink;noNewPublication=$true}|ConvertTo-Json|Set-Content $trProof -Encoding UTF8
 }
}
# FORECAST_SPOOL_REPLAY: preserve original pre-start times after transient DB contention.
$spoolExit=Run-Node @('--use-system-ca','server/flush-forecast-spool.mjs') 'data/maintenance/forecast-spool-replay'
# NATIVE_MEDIA_UPLOAD_PROBE: once, through the real task profile.
if(-not(Test-Path data/maintenance/native-media-upload-probe.json)){
 $mediaExit=Run-Node @('--use-system-ca','server/check-native-media-upload.mjs') 'data/maintenance/native-media-upload-probe'
}
# DAILY_HISTORY_ENGINE: independent local worker; legacy hold remains for the old generative method.
$historyExit=0
$dailyPolicy='data/instagram/daily-history-policy.json'
if((Test-Path $dailyPolicy) -and (Get-Content $dailyPolicy -Raw|ConvertFrom-Json).enabled){
 & 'D:\Apps\HorseRide\server\dispatch-daily-history.ps1'
}else{
 $historyExit=Run-Node @('--use-system-ca','server/run-history-reel.mjs') 'data/instagram/history-agent'
}
$feedExit=Run-Node @('--use-system-ca','server/run-instagram-agent.mjs') 'data/instagram/agent'
& 'D:\Tools\node-v24.15.0-win-x64\node.exe' 'D:\Apps\HorseRide\server\publication-watchdog.mjs' '--context=instagram-after' *> 'D:\Apps\HorseRide\data\maintenance\publication-watchdog-instagram-after.log'
if($feedExit -ne 0 -or $historyExit -ne 0){exit 1}
exit 0
