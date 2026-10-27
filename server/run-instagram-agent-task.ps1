$ErrorActionPreference='Stop'
$job=Start-Process 'D:\Tools\node-v24.15.0-win-x64\node.exe' -ArgumentList '--use-system-ca','D:\Apps\HorseRide\server\run-instagram-agent.mjs' -WorkingDirectory 'D:\Apps\HorseRide' -WindowStyle Hidden -RedirectStandardOutput 'D:\Apps\HorseRide\data\instagram\agent.stdout.log' -RedirectStandardError 'D:\Apps\HorseRide\data\instagram\agent.stderr.log' -Wait -PassThru
exit $job.ExitCode
