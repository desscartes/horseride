$ErrorActionPreference='Stop'
Set-Location -LiteralPath 'D:\Apps\HorseRide'
$t=Get-ScheduledTask -TaskName 'HorseRide-Instagram-Agent'
$s=$t.Settings;$s.ExecutionTimeLimit='PT1H'
Set-ScheduledTask -TaskName $t.TaskName -Settings $s | Out-Null
Start-ScheduledTask -TaskName $t.TaskName
@{status='started';checkedAt=[datetime]::UtcNow.ToString('o');logonType=[string](Get-ScheduledTask -TaskName $t.TaskName).Principal.LogonType} | ConvertTo-Json | Set-Content -LiteralPath 'data/maintenance/unattended-finish.json' -Encoding UTF8
