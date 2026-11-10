$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$stage='D:\Apps\HorseRide\data\maintenance\native-speech-transfer'
$source=Join-Path $stage 'credential.dpapi.json'
if(-not(Test-Path -LiteralPath $source)){return}
$meta=Get-Content (Join-Path $stage 'transfer.json') -Raw|ConvertFrom-Json
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if($meta.sid -ne $sid){throw 'Native speech transfer identity mismatch'}
$policy=Get-Content 'D:\Apps\HorseRide\data\instagram\native-renderer\azure-policy.json' -Raw|ConvertFrom-Json
$credential=Get-Content -LiteralPath $source -Raw|ConvertFrom-Json
if($credential.resourceId -ne $policy.resourceId){throw 'Native speech resource mismatch'}
# Only CurrentUser DPAPI ciphertext is copied. The key is never decrypted here.
$target=Join-Path $env:LOCALAPPDATA 'HorseRide\azure-speech.dpapi.json'
New-Item -ItemType Directory -Path (Split-Path $target) -Force|Out-Null
if(Test-Path $target){
 if((Get-FileHash $target).Hash -ne (Get-FileHash $source).Hash){throw 'An existing different speech credential needs review'}
}else{Copy-Item -LiteralPath $source -Destination $target}
if((Get-FileHash $target).Hash -ne $meta.sha256){throw 'Native speech transfer checksum mismatch'}
Remove-Item -LiteralPath $source
@{status='completed';sameWindowsSid=$true;encryptedOnly=$true;temporaryCopyRemoved=$true;interactive=[Environment]::UserInteractive;checkedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content 'D:\Apps\HorseRide\data\maintenance\native-speech-setup.json' -Encoding UTF8
