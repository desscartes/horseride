param([switch]$Probe)
$ErrorActionPreference='Stop'
trap {
 @{status='failed';error=$_.Exception.Message;line=$_.InvocationInfo.ScriptLineNumber;checkedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath 'D:\Apps\HorseRide\data\maintenance\weekly-video-wrapper-error.json' -Encoding utf8
 exit 1
}
Set-Location 'D:\Apps\HorseRide'
$visibilityRequest='data/maintenance/video-runtime-visibility-request.json'
if(Test-Path -LiteralPath $visibilityRequest){
 $visibility=Get-Content -LiteralPath $visibilityRequest -Raw|ConvertFrom-Json
 if($visibility.status -eq 'pending'){
  $paths=@('C:\Users\desscartes\AppData\Local\HorseRide\video-runtime\cache-marker.json','C:\Users\desscartes\HorseRideVideoRuntime-Probe.txt')
  $results=@(foreach($path in $paths){$readable=$false;$errorType=$null;try{$null=[IO.File]::ReadAllText($path);$readable=$true}catch{$errorType=$_.Exception.GetType().Name};@{path=$path;exists=(Test-Path -LiteralPath $path);readable=$readable;errorType=$errorType}})
  @{checkedAt=[datetime]::UtcNow.ToString('o');identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;files=$results}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath 'data/maintenance/video-runtime-native-visibility.json' -Encoding utf8
  $visibility.status='completed';$visibility|ConvertTo-Json|Set-Content -LiteralPath $visibilityRequest -Encoding utf8
  exit 0
 }
}
$runtime='D:\Apps\HorseRide\video-runtime'
if(Test-Path -LiteralPath 'data/maintenance/video-runtime-config.json'){
 $runtimeConfig=Get-Content -LiteralPath 'data/maintenance/video-runtime-config.json' -Raw|ConvertFrom-Json
 if($runtimeConfig.enabled){
  if($runtimeConfig.path -notin @('D:\Apps\HorseRide\video-runtime','C:\Users\desscartes\AppData\Local\HorseRide\video-runtime','C:\Users\desscartes\HorseRideVideoRuntime')){throw 'Unexpected application video cache path'}
  if((Get-Content -LiteralPath (Join-Path $runtimeConfig.path 'cache-marker.json') -Raw|ConvertFrom-Json).status -ne 'verified'){throw 'Video cache not verified'}
  $runtime=$runtimeConfig.path
 }
}
$cancelPath='data/maintenance/weekly-video-cancel-request.json'
if(Test-Path -LiteralPath $cancelPath){
 $cancel=Get-Content -LiteralPath $cancelPath -Raw|ConvertFrom-Json
 if($cancel.status -eq 'pending' -and [datetimeoffset]::Parse($cancel.expiresAt) -gt [datetimeoffset]::UtcNow){
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'D:\Apps\HorseRide\server\cancel-owned-weekly-video.ps1'
  exit $LASTEXITCODE
 }
}
$validationPath='data/maintenance/weekly-video-validation-request.json'
$validation=$null
if(Test-Path -LiteralPath $validationPath){
 try{$candidate=Get-Content -LiteralPath $validationPath -Raw|ConvertFrom-Json;if($candidate.status -eq 'pending' -and [datetimeoffset]::Parse($candidate.expiresAt) -gt [datetimeoffset]::UtcNow){$validation=$candidate}}catch{}
}
$productionPath='data/maintenance/weekly-video-production-request.json'
$production=$null
if(Test-Path -LiteralPath $productionPath){
 try{$candidate=Get-Content -LiteralPath $productionPath -Raw|ConvertFrom-Json;if($candidate.status -in @('pending','running') -and [datetimeoffset]::Parse($candidate.expiresAt) -gt [datetimeoffset]::UtcNow){$production=$candidate}}catch{}
}
if(-not $Probe -and -not $validation -and -not $production){
 $policyPath='data/instagram/weekly-stock/policy.json'
 if(-not(Test-Path $policyPath) -or -not (Get-Content $policyPath -Raw|ConvertFrom-Json).fullBatchEnabled){
  @{status='paused_pending_production_test';checkedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content data/maintenance/weekly-video-run-state.json -Encoding UTF8
  exit 0
 }
}
$env:PYTHONUTF8='1'
$env:HF_HUB_OFFLINE='1'
$env:TRANSFORMERS_OFFLINE='1'
$env:HF_HOME=Join-Path $runtime 'cache'
$env:OMP_NUM_THREADS='2'
$env:MKL_NUM_THREADS='2'
$env:OPENBLAS_NUM_THREADS='2'
@{status='starting';interactive=[Environment]::UserInteractive;identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;at=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content data/maintenance/weekly-video-bootstrap.json -Encoding UTF8
$python=Join-Path $runtime '.venv\Scripts\python.exe'
if($production){
 if($production.episode -notmatch '^[a-z0-9-]{1,90}$' -or $production.sceneCount -notin @(4,8)){throw 'Invalid local draft request'}
 $motionFrames=65;if($production.PSObject.Properties['motionFrames']){$motionFrames=$production.motionFrames};if($motionFrames -notin @(49,65)){throw 'Invalid local motion length'}
 $production.status='running';$production|ConvertTo-Json|Set-Content -LiteralPath $productionPath -Encoding utf8
 & $python -u 'D:\Apps\HorseRide\server\weekly-video-worker.py' --episode $production.episode --scene-count $production.sceneCount --motion-frames $motionFrames *>> data/maintenance/weekly-video-production.log
 $code=$LASTEXITCODE
 $production.status=if($code -eq 0){'rendered_pending_review'}else{'failed'}
 $production|ConvertTo-Json|Set-Content -LiteralPath $productionPath -Encoding utf8
 @{status=$production.status;episode=$production.episode;exitCode=$code;interactive=[Environment]::UserInteractive;checkedAt=[datetime]::UtcNow.ToString('o');codexRequired=$false;publishing=$false}|ConvertTo-Json|Set-Content data/maintenance/weekly-video-production-result.json -Encoding utf8
 exit $code
}
if($validation){$validation.status='running';$validation|ConvertTo-Json|Set-Content -LiteralPath $validationPath -Encoding utf8}
$test=[Diagnostics.Process]::new()
$test.StartInfo=[Diagnostics.ProcessStartInfo]::new()
$test.StartInfo.FileName=$python
$test.StartInfo.Arguments='-u "D:\Apps\HorseRide\server\gpu-task-probe.py"'
$test.StartInfo.UseShellExecute=$false
$test.StartInfo.CreateNoWindow=$true
$test.StartInfo.RedirectStandardOutput=$true
$test.StartInfo.RedirectStandardError=$true
$test.StartInfo.WorkingDirectory='D:\Apps\HorseRide'
# Keep the original process handle: Start-Process -PassThru can lose ExitCode in Windows PowerShell.
$null=$test.Start()
$stdout=$test.StandardOutput.ReadToEndAsync();$stderr=$test.StandardError.ReadToEndAsync()
if(-not $test.WaitForExit(900000)){
 if(-not $test.HasExited){& taskkill.exe /PID $test.Id /T /F | Out-Null}
 @{status='gpu_initialization_timeout';at=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content data/maintenance/weekly-video-bootstrap.json -Encoding UTF8
 if($validation){
  $validation.status='timed_out';$validation|ConvertTo-Json|Set-Content -LiteralPath $validationPath -Encoding utf8
  @{status='timed_out';requestId=$validation.id;interactive=[Environment]::UserInteractive;identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;checkedAt=[datetime]::UtcNow.ToString('o');codexRequired=$false;publishing=$false;gpuOnly=$true}|ConvertTo-Json|Set-Content data/maintenance/weekly-video-native-validation.json -Encoding utf8
 }
 exit 1
}
$test.WaitForExit()
[IO.File]::WriteAllText('D:\Apps\HorseRide\data\maintenance\weekly-gpu-test.stdout.log',$stdout.GetAwaiter().GetResult())
[IO.File]::WriteAllText('D:\Apps\HorseRide\data\maintenance\weekly-gpu-test.stderr.log',$stderr.GetAwaiter().GetResult())
$probeExitCode=$test.ExitCode
if($validation){
 $passed=$probeExitCode -eq 0
 $validation.status=if($passed){'passed'}else{'failed'}
 $validation|ConvertTo-Json|Set-Content -LiteralPath $validationPath -Encoding utf8
 @{status=$validation.status;requestId=$validation.id;exitCode=$probeExitCode;interactive=[Environment]::UserInteractive;identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;checkedAt=[datetime]::UtcNow.ToString('o');codexRequired=$false;publishing=$false;gpuOnly=$true}|ConvertTo-Json|Set-Content data/maintenance/weekly-video-native-validation.json -Encoding utf8
 if($passed){exit 0}else{exit 1}
}
if($probeExitCode -ne 0){exit $probeExitCode}
$argsList=@('-u','D:\Apps\HorseRide\server\weekly-video-worker.py')
if($Probe){$argsList+='--probe'}
& $python @argsList *>> data/maintenance/weekly-video-task.log
exit $LASTEXITCODE
