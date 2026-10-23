$ErrorActionPreference='Stop'
$job=Start-Process -FilePath 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','D:\Apps\HorseRide\server\run-commentary-watchdog.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\commentary-watchdog.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\commentary-watchdog-error.log' -PassThru
try{$job.PriorityClass='BelowNormal'}catch{}
$job.WaitForExit()
$commentaryExit=$job.ExitCode
$coupons=Start-Process 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','server/run-coupon-watchdog.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\maintenance\coupon-watchdog.log' -RedirectStandardError 'D:\Apps\HorseRide\data\maintenance\coupon-watchdog-error.log' -PassThru
try{$coupons.PriorityClass='BelowNormal'}catch{}
$coupons.WaitForExit()
exit $commentaryExit
