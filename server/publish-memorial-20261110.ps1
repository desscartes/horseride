param([ValidateSet('feed','story')][string]$Kind,[ValidateSet('Prepare','Publish','Verify')][string]$Mode='Prepare')
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
$dir=Join-Path 'D:\Apps\HorseRide\data\instagram' ('remembrance-20261110-'+$Kind);$path=Join-Path $dir 'publication.json';$token=$null;$headers=$null;$lock=$null;$phase='initializing'
function Save($entry){$entry|ConvertTo-Json -Depth 8|Set-Content -LiteralPath ($path+'.tmp') -Encoding UTF8;Move-Item -LiteralPath ($path+'.tmp') -Destination $path -Force}
function Read-Graph($route){Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$route) -Headers $headers -TimeoutSec 30}
function Write-Graph($route,$values){$parts=foreach($key in $values.Keys){[uri]::EscapeDataString($key)+'='+[uri]::EscapeDataString([string]$values[$key])};Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$route) -Method Post -Headers $headers -ContentType 'application/x-www-form-urlencoded; charset=utf-8' -Body ($parts -join '&') -TimeoutSec 45}
try{
 $lock=[IO.File]::Open((Join-Path $dir 'publish.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $m=Get-Content (Join-Path $dir 'manifest.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($m.id -ne ('remembrance-20261110-'+$Kind) -or $m.instagramId -ne '17841441483231653' -or $m.account -ne 'ganyan_zekasi' -or $m.imageUrl -ne 'https://ganyan-zekasi.tailab9792.ts.net/social/10-kasim-2026-anma-v3.png' -or -not $m.userApproved){throw 'Unexpected approved memorial manifest'}
 if((Get-FileHash (Join-Path $dir 'approved.png') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $m.imageSha256){throw 'Approved artwork changed'}
 $manifestHash=(Get-FileHash (Join-Path $dir 'manifest.json') -Algorithm SHA256).Hash;$entry=$null
 if(Test-Path $path){$entry=Get-Content $path -Raw -Encoding UTF8|ConvertFrom-Json;if($entry.manifestHash -ne $manifestHash){throw 'Publication content changed'}}
 if($entry.status -eq 'publishing_unknown'){throw 'Unknown outcome; do not issue a duplicate POST'}
 $secure=ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram\user-token.dpapi')))
 $token=[Net.NetworkCredential]::new('',$secure).Password;$headers=@{Authorization=('Bearer '+$token)}
 $phase='identity';$ig=Read-Graph '17841441483231653?fields=id,username'
 if($ig.username -ne 'ganyan_zekasi'){throw 'Account identity mismatch'}
 if($Kind -eq 'story'){$config=Get-Content 'D:\Apps\HorseRide\data\instagram\agent-config.json' -Raw -Encoding UTF8|ConvertFrom-Json;if($config.accountType -ne 'BUSINESS'){throw 'Story publication requires the verified business-account configuration'}}
 if($entry.mediaId){
  $phase='verify_existing'
  if($Kind -eq 'feed'){$media=Read-Graph ($entry.mediaId+'?fields=id,caption,permalink,timestamp');if($media.caption -ne $m.caption){throw 'Caption mismatch'};$entry.permalink=$media.permalink}
  else{$list=Read-Graph '17841441483231653/stories?fields=id,timestamp,media_type';$media=@($list.data|Where-Object {$_.id -eq $entry.mediaId})|Select-Object -First 1;if(-not $media){throw 'Published Story is not in account stories'}}
  $entry.status='published_verified';$entry.verifiedAt=[datetime]::UtcNow.ToString('o');$entry|Add-Member publishedAt $media.timestamp -Force;Save $entry;$entry|ConvertTo-Json -Depth 6;exit 0
 }
 if($Mode -eq 'Verify'){throw 'No published media to verify'}
 if(-not $entry){
  $phase='create_container';$values=@{image_url=$m.imageUrl}
  if($Kind -eq 'story'){$values.media_type='STORIES'}else{$values.caption=$m.caption;$values.alt_text=$m.altText}
  $created=Write-Graph '17841441483231653/media' $values;if($created.id -notmatch '^\d+$'){throw 'Invalid container response'}
  $entry=[pscustomobject]@{id=$m.id;manifestHash=$manifestHash;account=$m.account;kind=$Kind;status='container_created';containerId=$created.id;mediaId=$null;permalink=$null;createdAt=[datetime]::UtcNow.ToString('o');verifiedAt=$null};Save $entry
 }
 $phase='container_status';$container=Read-Graph ($entry.containerId+'?fields=status_code')
 if($container.status_code -ne 'FINISHED'){@{status=$container.status_code;published=$false}|ConvertTo-Json;exit 0}
 $entry.status='ready';Save $entry;if($Mode -eq 'Prepare'){$entry|ConvertTo-Json;exit 0}
 $phase='publish';$entry.status='publishing_unknown';Save $entry
 $published=Write-Graph '17841441483231653/media_publish' @{creation_id=$entry.containerId};if($published.id -notmatch '^\d+$'){throw 'Invalid publish response'}
 $entry.mediaId=$published.id;$entry.status='published';Save $entry
 $phase='verify_published'
 if($Kind -eq 'feed'){$media=Read-Graph ($entry.mediaId+'?fields=id,caption,permalink,timestamp');if($media.caption -ne $m.caption){throw 'Caption mismatch'};$entry.permalink=$media.permalink}
 else{$list=Read-Graph '17841441483231653/stories?fields=id,timestamp,media_type';$media=@($list.data|Where-Object {$_.id -eq $entry.mediaId})|Select-Object -First 1;if(-not $media){throw 'Story is not in account stories'}}
 $entry.status='published_verified';$entry.verifiedAt=[datetime]::UtcNow.ToString('o');$entry|Add-Member publishedAt $media.timestamp -Force;Save $entry;$entry|ConvertTo-Json -Depth 6
}catch{
 $code=$null;$subcode=$null;$message=$null
 try{$e=$_.ErrorDetails.Message|ConvertFrom-Json;$code=$e.error.code;$subcode=$e.error.error_subcode;$message=([string]$e.error.message)-replace '[A-Za-z0-9_-]{45,}','[redacted]'}catch{}
 @{phase=$phase;errorType=$_.Exception.GetType().Name;apiCode=$code;apiSubcode=$subcode;apiMessage=$message;automaticRetry=$false}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $dir 'last-error.json') -Encoding UTF8
 Write-Output 'Memorial publication failed; sanitized error saved; no blind retry';exit 1
}finally{$token=$null;$headers=$null;$secure=$null;if($lock){$lock.Dispose()}}
