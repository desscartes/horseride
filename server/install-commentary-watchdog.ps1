$ErrorActionPreference='Stop'
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File D:\Apps\HorseRide\server\run-commentary-watchdog-task.ps1' -WorkingDirectory 'D:\Apps\HorseRide'
$trigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -Hidden
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'HorseRide-Commentary-Watchdog' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Prepare current upcoming race commentary without LLM/training dependency; read-only, no paid calls.' -Force
