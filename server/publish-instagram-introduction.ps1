param([ValidateSet('Prepare','Publish','Verify')][string]$Mode='Prepare')
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$directory='D:\Apps\HorseRide\data\instagram\introduction-v1'
$ledgerPath=Join-Path $directory 'publication.json'
$manifestPath=Join-Path $directory 'manifest.json'
$lockPath=Join-Path $directory 'publish.lock'
$token=$null;$headers=$null;$lock=$null;$phase='initializing'
function Save-Ledger($entry){$temp=$ledgerPath+'.tmp';$entry | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temp -Encoding UTF8;Move-Item -LiteralPath $temp -Destination $ledgerPath -Force}
function Graph-Read($path){Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$path) -Headers $headers -TimeoutSec 30}
function Graph-Write($path,$values){$parts=foreach($key in $values.Keys){[uri]::EscapeDataString($key)+'='+[uri]::EscapeDataString([string]$values[$key])};Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$path) -Method Post -Headers $headers -ContentType 'application/x-www-form-urlencoded; charset=utf-8' -Body ($parts -join '&') -TimeoutSec 45}
try{
 $lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
 if($manifest.id -ne 'introduction-v1' -or $manifest.account -ne 'ganyan_zekasi' -or $manifest.instagramId -ne '17841441483231653' -or $manifest.imageUrl -notmatch '^https://raw\.githubusercontent\.com/desscartes/horseride/[a-f0-9]{40}/public/social/ganyan-introduction-v1\.jpg$'){throw 'Invalid fixed introduction manifest'}
 if((Get-FileHash -LiteralPath 'D:\Apps\HorseRide\public\social\ganyan-introduction-v1.jpg' -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.imageSha256){throw 'Artwork hash mismatch'}
 $manifestHash=(Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash
 $entry=$null
 if(Test-Path -LiteralPath $ledgerPath){$entry=Get-Content -LiteralPath $ledgerPath -Raw -Encoding UTF8 | ConvertFrom-Json;if($entry.manifestHash -ne $manifestHash){throw 'Existing publication content changed'}}
 if($entry -and $entry.status -eq 'publishing_unknown'){throw 'Previous publish outcome requires reconciliation; do not retry automatically'}
 $secure=ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram\user-token.dpapi')))
 $token=[Net.NetworkCredential]::new('',$secure).Password
 $headers=@{Authorization=('Bearer '+$token)}
 $phase='identity'
 $ig=Graph-Read ($manifest.instagramId+'?fields=id,username')
 if($ig.username -ne $manifest.account){throw 'Account identity mismatch'}
 if($entry -and $entry.mediaId){
  $phase='verify_existing'
  $media=Graph-Read ($entry.mediaId+'?fields=id,permalink,timestamp,caption')
  if($media.caption -ne $manifest.caption){throw 'Published caption mismatch'}
  $entry.status='published_verified';$entry.permalink=$media.permalink;$entry.verifiedAt=[DateTime]::UtcNow.ToString('o');Save-Ledger $entry
  Write-Output ($entry | ConvertTo-Json -Depth 8);exit 0
 }
 if($Mode -eq 'Verify'){throw 'No published media to verify'}
 if(-not $entry){
  $phase='create_container'
  $created=Graph-Write ($manifest.instagramId+'/media') @{image_url=$manifest.imageUrl;caption=$manifest.caption;alt_text=$manifest.altText}
  if($created.id -notmatch '^\d+$'){throw 'Invalid container response'}
  $entry=[pscustomobject]@{id=$manifest.id;manifestHash=$manifestHash;account=$manifest.account;status='container_created';containerId=$created.id;mediaId=$null;permalink=$null;createdAt=[DateTime]::UtcNow.ToString('o');verifiedAt=$null}
  Save-Ledger $entry
 }
 $phase='container_status'
 $container=Graph-Read ($entry.containerId+'?fields=status_code')
 if($container.status_code -ne 'FINISHED'){Write-Output (@{status=$container.status_code;containerId=$entry.containerId;published=$false} | ConvertTo-Json);exit 0}
 $entry.status='ready';Save-Ledger $entry
 if($Mode -eq 'Prepare'){Write-Output ($entry | ConvertTo-Json -Depth 8);exit 0}
 # Persist uncertainty BEFORE the request. A timeout never causes a blind duplicate POST.
 $phase='publish'
 $entry.status='publishing_unknown';Save-Ledger $entry
 $published=Graph-Write ($manifest.instagramId+'/media_publish') @{creation_id=$entry.containerId}
 if($published.id -notmatch '^\d+$'){throw 'Invalid publish response'}
 $entry.mediaId=$published.id;$entry.status='published';Save-Ledger $entry
 $phase='verify_published'
 $media=Graph-Read ($entry.mediaId+'?fields=id,permalink,timestamp,caption')
 if($media.caption -ne $manifest.caption){throw 'Published caption mismatch'}
 $entry.status='published_verified';$entry.permalink=$media.permalink;$entry.verifiedAt=[DateTime]::UtcNow.ToString('o');Save-Ledger $entry
 Write-Output ($entry | ConvertTo-Json -Depth 8)
}catch{
 $apiCode=$null;$apiSubcode=$null
 try{$e=$_.ErrorDetails.Message | ConvertFrom-Json;$apiCode=$e.error.code;$apiSubcode=$e.error.error_subcode}catch{}
 @{checkedAt=[DateTime]::UtcNow.ToString('o');phase=$phase;errorType=$_.Exception.GetType().FullName;apiCode=$apiCode;apiSubcode=$apiSubcode;line=$_.InvocationInfo.ScriptLineNumber;automaticRetry=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $directory 'last-error.json') -Encoding UTF8
 Write-Output 'Instagram operation failed; sanitized local error saved. No automatic retry.';exit 1
}finally{$token=$null;$secure=$null;$headers=$null;if($lock){$lock.Dispose()}}
