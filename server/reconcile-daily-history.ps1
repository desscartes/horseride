param([ValidatePattern('^[a-z0-9-]{1,90}$')][string]$PublicationId)
$ErrorActionPreference='Stop';$token=$null;$headers=$null;$lock=$null
try{
 $dir=Join-Path 'D:\Apps\HorseRide\data\instagram' $PublicationId
 $lock=[IO.File]::Open((Join-Path $dir 'publish.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 $manifest=Get-Content (Join-Path $dir 'manifest.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $ledger=Get-Content (Join-Path $dir 'publication.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($manifest.account -ne 'ganyan_zekasi' -or $manifest.instagramId -ne '17841441483231653' -or $manifest.id -ne $PublicationId -or $manifest.kind -ne 'historical_reel'){throw 'Invalid fixed account manifest'}
 if($ledger.status -ne 'publishing_unknown'){Write-Output 'No reconciliation required';exit 0}
 if((Get-FileHash (Join-Path $dir 'manifest.json') -Algorithm SHA256).Hash -ne $ledger.manifestHash){throw 'Manifest changed'}
 $secure=ConvertTo-SecureString ([IO.File]::ReadAllText((Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram\user-token.dpapi')))
 $token=[Net.NetworkCredential]::new('',$secure).Password;$headers=@{Authorization=('Bearer '+$token)}
 $items=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/17841441483231653/media?fields=id,caption,timestamp,permalink&limit=30' -Headers $headers -TimeoutSec 30
 $matches=@($items.data|Where-Object {$_.caption -eq $manifest.caption -and $_.id -match '^\d+$' -and $_.permalink -match '^https://www.instagram.com/' -and [datetimeoffset]::Parse($_.timestamp) -ge ([datetimeoffset]::Parse($ledger.createdAt)).AddMinutes(-1)})
 if($matches.Count -ne 1){Write-Output 'Uncertain outcome retained; no POST or retry performed';exit 0}
 $m=$matches[0];$ledger.mediaId=$m.id;$ledger.permalink=$m.permalink;$ledger.status='published_verified';$ledger.verifiedAt=[DateTime]::UtcNow.ToString('o');$ledger|Add-Member -NotePropertyName publishedAt -NotePropertyValue $m.timestamp -Force
 $path=Join-Path $dir 'publication.json';$ledger|ConvertTo-Json -Depth 8|Set-Content ($path+'.reconcile.tmp') -Encoding UTF8;Move-Item -LiteralPath ($path+'.reconcile.tmp') -Destination $path -Force
 Write-Output 'Existing publication verified by exact caption/time; no new publication requested'
}catch{Write-Output ('Reconciliation unavailable: '+$_.Exception.GetType().Name);exit 1}finally{if($lock){$lock.Dispose()};$token=$null;$headers=$null}
