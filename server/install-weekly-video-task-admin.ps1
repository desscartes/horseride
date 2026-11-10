$ErrorActionPreference='Stop'
try{
 $root='D:\Apps\HorseRide'
 foreach($name in @('HorseRide-Weekly-Video-Preparation','HorseRide-Weekly-Video-Probe')){if(Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue){Stop-ScheduledTask -TaskName $name}}
 $runtime=Join-Path $root 'video-runtime'
 if((Resolve-Path $runtime).Path -ne 'D:\Apps\HorseRide\video-runtime' -or ((Get-Item $runtime).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Unexpected video runtime target'}
 $service=Join-Path $runtime 'service';New-Item -ItemType Directory -Path $service -Force|Out-Null
 foreach($name in @('weekly-video-worker.py','local-first-frame.py','gpu-task-probe.py','run-weekly-video-task.ps1')){Copy-Item -LiteralPath (Join-Path $root ('server/'+$name)) -Destination (Join-Path $service $name) -Force}
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 & icacls.exe $runtime /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' "*$($sid):(OI)(CI)RX" /T /Q | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Runtime ACL setup failed'}
 & icacls.exe $runtime /setowner '*S-1-5-18' /T /Q | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Runtime ownership setup failed'}
 foreach($p in @('server/weekly-video-worker.py','server/run-weekly-video-task.ps1','server/local-first-frame.py','video-runtime/.venv/Scripts/python.exe','video-runtime/pilot_scene.py','video-runtime/sd15/verified-model.json')){if(-not(Test-Path (Join-Path $root $p))){throw ('Runtime prerequisite missing: '+$p)}}
 $action=New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File D:\Apps\HorseRide\video-runtime\service\run-weekly-video-task.ps1' -WorkingDirectory $root
 $triggers=@((New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At '00:30'),(New-ScheduledTaskTrigger -AtStartup))
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 36) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 15) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 $principal=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
 Register-ScheduledTask -TaskName 'HorseRide-Weekly-Video-Preparation' -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Local weekly original history motion stock; no Instagram access or paid APIs. Restart-resumable; rendered drafts require visual review.' -Force|Out-Null
 # First run is a real short pipeline test, isolated from the regular publishing account.
 $probeAction=New-ScheduledTaskAction -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File D:\Apps\HorseRide\video-runtime\service\run-weekly-video-task.ps1 -Probe' -WorkingDirectory $root
 Register-ScheduledTask -TaskName 'HorseRide-Weekly-Video-Probe' -Action $probeAction -Settings $settings -Principal $principal -Force|Out-Null
 $scheduler=New-Object -ComObject 'Schedule.Service';$scheduler.Connect();$folder=$scheduler.GetFolder('\')
 foreach($name in @('HorseRide-Weekly-Video-Preparation','HorseRide-Weekly-Video-Probe')){$folder.GetTask($name).SetSecurityDescriptor("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GR;;;$sid)",0)}
 Start-ScheduledTask -TaskName 'HorseRide-Weekly-Video-Probe'
 @{status='installed';revision=2;protectedRuntime=$true;weeklyDay='Saturday';turkeyTime='00:30';bootResume=$true;loggedInUserRequired=$false;account='SYSTEM';publishing=$false;probeStarted=$true;installedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content (Join-Path $root 'data/maintenance/weekly-video-install.json') -Encoding UTF8
}catch{
 @{status='failed';error=$_.Exception.Message;at=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content 'D:\Apps\HorseRide\data\maintenance\weekly-video-install.json' -Encoding UTF8
 throw
}
