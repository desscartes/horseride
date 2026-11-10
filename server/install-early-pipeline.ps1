$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ((Get-TimeZone).Id -ne 'Turkey Standard Time') { throw 'Task host is not on Turkey Standard Time.' }
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 4) -WakeToRun -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -Hidden
$powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach ($task in @(
    @{ Name = 'HorseRide-Nightly-Model-Training'; Hour = 2; Script = 'run-nightly-training-task.ps1'; Description = '02:00 TSİ completed-result training fallback; supervisor and lock prevent duplicate work.' },
    @{ Name = 'HorseRide-Morning-Preparation'; Hour = 6; Script = 'run-morning-task.ps1'; Description = '06:00 TSİ early program and race preparation; near-start refresh stays active.' }
)) {
    $script = Join-Path $PSScriptRoot $task.Script
    if (-not (Test-Path -LiteralPath $script)) { throw "Missing task script: $script" }
    $action = New-ScheduledTaskAction -Execute $powershell -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '"') -WorkingDirectory $root
    $nextStart = [datetime]::Today.AddHours($task.Hour)
    if ($nextStart -le (Get-Date)) { $nextStart = $nextStart.AddDays(1) }
    $trigger = New-ScheduledTaskTrigger -Daily -At $nextStart
    # Preserve unattended Password principal and Windows-stored credential.
    $existing=Get-ScheduledTask -TaskName $task.Name -ErrorAction SilentlyContinue
    if($existing -and $existing.Principal.LogonType -eq 'Password'){
        Set-ScheduledTask -TaskName $task.Name -Action $action -Settings $settings -Trigger $trigger | Out-Null
        continue
    }
    Register-ScheduledTask -TaskName $task.Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $task.Description -Force | Out-Null
}
Get-ScheduledTask -TaskName 'HorseRide-Nightly-Model-Training','HorseRide-Morning-Preparation' |
    Select-Object TaskName,State,@{Name='Start';Expression={$_.Triggers[0].StartBoundary}}
