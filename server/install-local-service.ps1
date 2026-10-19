$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path -Parent $PSScriptRoot
$taskLauncher = Join-Path $taskProjectRoot 'Baslat-GanyanZekasi.vbs'
if (-not (Test-Path -LiteralPath $taskLauncher)) { throw 'Servis baslatma dosyasi bulunamadi.' }
$taskScheduler = New-Object -ComObject 'Schedule.Service'
$taskScheduler.Connect()
$taskDefinition = $taskScheduler.NewTask(0)
$taskDefinition.RegistrationInfo.Description = 'Ganyan Zekasi API, gunluk veri/egitim ve yaris oncesi kayit gozetmeni.'
$taskUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskDefinition.Principal.UserId = $taskUser
$taskDefinition.Principal.LogonType = 3
$taskDefinition.Settings.Enabled = $true
$taskDefinition.Settings.StartWhenAvailable = $true
$taskDefinition.Settings.DisallowStartIfOnBatteries = $false
$taskDefinition.Settings.StopIfGoingOnBatteries = $false
$taskDefinition.Settings.ExecutionTimeLimit = 'PT0S'
$taskDefinition.Settings.RestartInterval = 'PT1M'
$taskDefinition.Settings.RestartCount = 3
$taskDefinition.Settings.MultipleInstances = 2
$taskLogin = $taskDefinition.Triggers.Create(9)
$taskLogin.UserId = $taskUser
$taskLogin.Delay = 'PT15S'
$taskDaily = $taskDefinition.Triggers.Create(2)
$taskDaily.StartBoundary = (Get-Date).Date.AddHours(6).ToString('yyyy-MM-ddTHH:mm:ss')
$taskDaily.DaysInterval = 1
$taskAction = $taskDefinition.Actions.Create(0)
$taskAction.Path = Join-Path $env:WINDIR 'System32\wscript.exe'
$taskAction.Arguments = '"' + $taskLauncher + '"'
$taskAction.WorkingDirectory = $taskProjectRoot
$taskScheduler.GetFolder('\').RegisterTaskDefinition('GanyanZekasi-Service',$taskDefinition,6,$taskUser,$null,3) | Out-Null
Write-Output 'Oturum acilisinda ve her gun 06:00 servis baslatma gorevi kaydedildi.'
