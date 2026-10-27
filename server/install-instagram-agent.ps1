$ErrorActionPreference='Stop'
$action=New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File D:\Apps\HorseRide\server\run-instagram-agent-task.ps1' -WorkingDirectory 'D:\Apps\HorseRide'
$trigger=New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(2)) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -Hidden
$principal=New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'HorseRide-Instagram-Agent' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Local Instagram meeting carousel publisher. Same-account DPAPI, verified country model, disclosed optional gaps, early program publication, official entry checks, up to four city carousels and two reels daily. No Codex or paid AI call.' -Force
