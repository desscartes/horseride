$ErrorActionPreference='Stop'
$root='D:\Apps\HorseRide'
$runtime=Join-Path $root 'video-runtime'
$configPath=Join-Path $root 'data/maintenance/video-runtime-config.json'
if(Test-Path -LiteralPath $configPath){$config=Get-Content -LiteralPath $configPath -Raw|ConvertFrom-Json;if($config.enabled){if($config.path -notin @('D:\Apps\HorseRide\video-runtime','C:\Users\desscartes\AppData\Local\HorseRide\video-runtime','C:\Users\desscartes\HorseRideVideoRuntime')){throw 'Unexpected runtime cache path'};$runtime=$config.path}}
$requestPath=Join-Path $root 'data/maintenance/weekly-video-cancel-request.json'
$request=Get-Content -LiteralPath $requestPath -Raw|ConvertFrom-Json
if($request.status -ne 'pending' -or [datetimeoffset]::Parse($request.expiresAt) -le [datetimeoffset]::UtcNow){throw 'No current application cancellation request'}
try {
 $owner=Get-Content -LiteralPath (Join-Path $runtime 'weekly-worker.lock') -Raw|ConvertFrom-Json
 if($owner.script -ne 'weekly-video-worker.py' -or $owner.pid -ne $request.expectedWorkerPid -or [math]::Abs($owner.process_started_at-$request.expectedWorkerStart) -gt .01){throw 'Application worker lease changed; refuse cancellation'}
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.pid)" -ErrorAction Stop
 if($process){
  $observed=([DateTimeOffset]$process.CreationDate).ToUnixTimeMilliseconds()/1000
  if([math]::Abs($observed-$owner.process_started_at) -gt .1 -or $process.CommandLine -notmatch '(?i)D:[\\/]+Apps[\\/]+HorseRide[\\/]+server[\\/]+weekly-video-worker\.py'){throw 'Process start or application script does not match; refuse cancellation'}
  & taskkill.exe /PID $owner.pid /T /F
  if($LASTEXITCODE -ne 0){throw 'Native task account could not stop its own video worker'}
 }
 $request.status='stopped';$request|Add-Member -NotePropertyName checkedAt -NotePropertyValue ([datetime]::UtcNow.ToString('o')) -Force
 $request|ConvertTo-Json|Set-Content -LiteralPath $requestPath -Encoding utf8
 @{status='stopped';workerPid=$owner.pid;identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name;checkedAt=$request.checkedAt;otherJobsTouched=$false}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data/maintenance/weekly-video-cancel-result.json') -Encoding utf8
 exit 0
}catch{
 @{status='failed';error=$_.Exception.Message;checkedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data/maintenance/weekly-video-cancel-result.json') -Encoding utf8
 exit 1
}
