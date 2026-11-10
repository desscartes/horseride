$ErrorActionPreference='Stop'
$root='D:\Apps\HorseRide'
$taskName='HorseRide-Weekly-Video-Preparation'
$account=(Get-ScheduledTask -TaskName 'HorseRide-Instagram-Agent' -ErrorAction Stop).Principal.UserId
# Replace the existing weekly task; never register a parallel GPU scheduler.
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if($existing.State -eq 'Running'){throw 'Existing weekly task is running; preserve it and refuse replacement.'}
$probe=Get-ScheduledTask -TaskName 'HorseRide-Weekly-Video-Probe' -ErrorAction SilentlyContinue
if($probe -and $probe.State -eq 'Running'){throw 'Existing GPU probe running; preserve it and refuse replacement.'}
foreach($name in @('weekly-video-worker.py','local-first-frame.py','gpu-task-probe.py','run-weekly-video-task.ps1')){
 if(-not(Test-Path -LiteralPath (Join-Path $root ('server/'+$name)))){throw "Missing runtime: $name"}
}
$action=New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File D:\Apps\HorseRide\server\run-weekly-video-task.ps1' -WorkingDirectory $root
$triggers=@((New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At '00:30'),(New-ScheduledTaskTrigger -AtStartup))
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 36) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
# Offline rendering needs neither SYSTEM privileges nor reusable network credentials.
# Speech and Instagram stay in the existing Password-logon publication task.
$principal=New-ScheduledTaskPrincipal -UserId $account -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Offline weekly original history motion stock; same user, no Codex, no SYSTEM privileges, no network credentials. Checkpoints survive restart. Drafts require visual review.' -Force|Out-Null
if($probe){Disable-ScheduledTask -TaskName $probe.TaskName|Out-Null}
$sid=(New-Object Security.Principal.NTAccount($account)).Translate([Security.Principal.SecurityIdentifier]).Value
$scheduler=New-Object -ComObject 'Schedule.Service';$scheduler.Connect();$folder=$scheduler.GetFolder('\')
# The limited task's owner can inspect/run it; cannot change its definition or gain admin rights.
$folder.GetTask($taskName).SetSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGX;;;$sid)",0)
$verified=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
if($verified.Principal.LogonType -ne 'S4U' -or $verified.Principal.RunLevel -ne 'Limited'){throw 'Unexpected registered task principal'}
Export-ScheduledTask -TaskName $taskName|Set-Content -LiteralPath (Join-Path $root 'data/maintenance/weekly-video-task.xml') -Encoding utf8
@{status='pending';id=[guid]::NewGuid().ToString();expiresAt=[datetime]::UtcNow.AddMinutes(15).ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data/maintenance/weekly-video-validation-request.json') -Encoding utf8
Start-ScheduledTask -TaskName $taskName
@{status='configured';revision=4;task=$taskName;account=$account;logonType='S4U';runLevel='Limited';bootResume=$true;userReadRunGranted=$true;validationStarted=$true;duplicateTaskCreated=$false;codexRequired=$false;publishing=$false;checkedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data/maintenance/weekly-video-install.json') -Encoding utf8
