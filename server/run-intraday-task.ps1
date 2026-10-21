$ErrorActionPreference='Stop'
$taskLog='D:\Apps\HorseRide\data\maintenance\intraday-task.log'
$taskError='D:\Apps\HorseRide\data\maintenance\intraday-task-error.log'
$job=Start-Process -FilePath 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','D:\Apps\HorseRide\server\run-intraday-collection.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput $taskLog -RedirectStandardError $taskError -PassThru
try{$job.PriorityClass='BelowNormal'}catch{}
$job.WaitForExit()
exit $job.ExitCode
