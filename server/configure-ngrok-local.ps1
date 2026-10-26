$ErrorActionPreference='Stop'
$dir=Join-Path $env:LOCALAPPDATA 'ngrok'
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$path=Join-Path $dir 'horseride.yml'
if(Test-Path -LiteralPath $path){throw 'Existing HorseRide ngrok config retained; do not overwrite.'}
Write-Host 'Paste your ngrok authtoken from dashboard.ngrok.com/get-started/your-authtoken. Input is hidden and never sent to chat.'
$secure=Read-Host 'ngrok authtoken' -AsSecureString
$value=[Net.NetworkCredential]::new('', $secure).Password
if($value.Length -lt 20 -or $value -match '\s'){throw 'Invalid token format'}
@{version='3';agent=@{authtoken=$value}} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $path -Encoding ASCII
$acl=Get-Acl -LiteralPath $path
$acl.SetAccessRuleProtection($true,$false)
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner,'FullControl','Allow'))
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new('SYSTEM','FullControl','Allow'))
Set-Acl -LiteralPath $path -AclObject $acl
$value=$null;$secure=$null
& 'D:\Tools\ngrok\ngrok.exe' config check --config $path
if($LASTEXITCODE -ne 0){throw 'Config validation failed'}
Write-Host 'Saved locally. Starting public watchdog.'
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File 'D:\Apps\HorseRide\server\run-public-watchdog.ps1'
