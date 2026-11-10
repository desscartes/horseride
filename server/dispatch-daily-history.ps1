$ErrorActionPreference='Stop'
$app='D:\Apps\HorseRide'
$worker='daily-history-engine.py'
$istanbulDay=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow,'Turkey Standard Time').ToString('yyyy-MM-dd')
$statePath="$app\data\maintenance\daily-history-engine.json"
if(Test-Path -LiteralPath $statePath){
 $state=Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json
 if($state.day -eq $istanbulDay -and $state.status -eq 'published_verified'){$worker='prepare-history-stock.py'}
}
$replacementPath="$app\data\instagram\history-replacement-request.json"
if(Test-Path -LiteralPath $replacementPath){
 $replacement=Get-Content -LiteralPath $replacementPath -Raw|ConvertFrom-Json
 if($replacement.userRequested -and $replacement.day -eq $istanbulDay -and $replacement.status -ne 'published_verified'){$worker='daily-history-engine.py'}
}
$processes=Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction Stop
if($processes|Where-Object {$_.CommandLine -match '[\\/]server[\\/](daily-history-engine|prepare-history-stock)\.py(?:"|\s|$)'}){exit 0}
$logName=[IO.Path]::GetFileNameWithoutExtension($worker)
$job=Start-Process -FilePath "$app\.venv\Scripts\python.exe" -ArgumentList '-u',"$app\server\$worker" -WorkingDirectory $app -WindowStyle Hidden -PassThru -RedirectStandardOutput "$app\data\maintenance\$logName.stdout.log" -RedirectStandardError "$app\data\maintenance\$logName.stderr.log"
try{$job.PriorityClass='BelowNormal'}catch{}
