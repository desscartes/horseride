# Read-only remote verification for this exact, user-requested replacement. Never deletes media.
$ErrorActionPreference='Stop';$token=$null;$headers=$null
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
$root='D:\Apps\HorseRide\data\instagram';$planPath=Join-Path $root 'history-replacement-request.json'
function Save-Plan($v){$v|ConvertTo-Json -Depth 8|Set-Content -LiteralPath ($planPath+'.tmp') -Encoding UTF8;Move-Item -LiteralPath ($planPath+'.tmp') -Destination $planPath -Force}
try{
 $p=Get-Content $planPath -Raw|ConvertFrom-Json
 if(-not $p.userRequested -or $p.oldPublicationId -ne 'history-daily-2026-11-08-pimlico-1938-archive' -or $p.newPublicationId -ne 'history-daily-2026-11-08-pimlico-1938-editorial-v2' -or $p.day -ne '2026-11-08'){throw 'Unexpected replacement request'}
 if($p.status -in @('published_verified','removal_verified')){exit 0}
 $dir=Join-Path $root $p.oldPublicationId;$path=Join-Path $dir 'publication.json';$ledger=Get-Content $path -Raw|ConvertFrom-Json
 if($ledger.mediaId -ne '18027304934926958' -or $ledger.permalink -ne 'https://www.instagram.com/reel/DfeTXLlkd8z/'){throw 'Unexpected rejected media identity'}
 $secure=ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram\user-token.dpapi')))
 $token=[Net.NetworkCredential]::new('',$secure).Password;$headers=@{Authorization=('Bearer '+$token)}
 $list=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/17841441483231653/media?fields=id,permalink&limit=100' -Headers $headers -TimeoutSec 30
 if(@($list.data|Where-Object {$_.id -eq $ledger.mediaId}).Count){$p.status='waiting_for_remote_removal';$p|Add-Member firstAbsenceAt $null -Force;Save-Plan $p;Write-Output 'Old media still present; replacement not released';exit 0}
 # A successful account read and an independently inaccessible exact media are both required.
 if(-not @($list.data).Count){throw 'Empty account response is not proof of removal'}
 $gone=$false
 try{$null=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/18027304934926958?fields=id,permalink' -Headers $headers -TimeoutSec 30}
 catch{
  $details=$_.ErrorDetails.Message|ConvertFrom-Json
  if($details.error.code -eq 100 -and $details.error.error_subcode -eq 33){$gone=$true}else{throw 'Ambiguous target read; removal not confirmed'}
 }
 if(-not $gone){throw 'Target is still retrievable; removal not confirmed'}
 if(-not $p.firstAbsenceAt){$p.status='confirming_remote_absence';$p|Add-Member firstAbsenceAt ([datetime]::UtcNow.ToString('o')) -Force;Save-Plan $p;exit 0}
 if(([datetimeoffset]::UtcNow-[datetimeoffset]::Parse($p.firstAbsenceAt)).TotalSeconds -lt 60){exit 0}
 Copy-Item -LiteralPath $path -Destination (Join-Path $dir 'publication.before-user-removal.json') -Force
 $ledger.status='removed_by_user_request';$ledger|Add-Member removedAt ([datetime]::UtcNow.ToString('o')) -Force
 $ledger|Add-Member removalEvidence 'Exact user-requested target absent from account and unavailable by media ID on two checks >=60 seconds apart; no API DELETE performed' -Force
 $ledger|ConvertTo-Json -Depth 8|Set-Content -LiteralPath ($path+'.tmp') -Encoding UTF8;Move-Item -LiteralPath ($path+'.tmp') -Destination $path -Force
 $p.status='removal_verified';Save-Plan $p;Write-Output 'Remote removal verified; replacement may proceed only through quality gates'
}catch{Write-Output ('Remote removal verification unavailable: '+$_.Exception.GetType().Name+' line '+$_.InvocationInfo.ScriptLineNumber+' command '+$_.InvocationInfo.InvocationName);exit 1}finally{$token=$null;$headers=$null}
