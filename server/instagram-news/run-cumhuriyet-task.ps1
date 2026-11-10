$ErrorActionPreference='Stop'
Set-Location -LiteralPath 'D:\Apps\HorseRide'
$log='D:\Apps\HorseRide\data\instagram\cumhuriyet-2026-10-29\scheduled-publish.log'
& 'D:\Tools\node-v24.15.0-win-x64\node.exe' --use-system-ca 'D:\Apps\HorseRide\server\instagram-news\publish-cumhuriyet.mjs' *>> $log
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
