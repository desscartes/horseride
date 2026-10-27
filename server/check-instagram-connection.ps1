$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Utility\Microsoft.PowerShell.Utility.psd1') -ErrorAction Stop
$path=Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram\user-token.dpapi'
$token=$null;$headers=$null;$phase='initializing'
try{
 $secure=ConvertTo-SecureString ([IO.File]::ReadAllText($path))
 $token=[Net.NetworkCredential]::new('',$secure).Password
 $headers=@{Authorization=('Bearer '+$token)}
 $phase='token_status'
 $info=Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/debug_token?input_token='+[uri]::EscapeDataString($token)) -Headers $headers -TimeoutSec 25
 if(-not $info.data.is_valid -or $info.data.app_id -ne '3087033018311346'){throw 'Unexpected application or invalid credential'}
 $phase='instagram_identity'
 $ig=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/17841441483231653?fields=id,username' -Headers $headers -TimeoutSec 25
 if($ig.username -ne 'ganyan_zekasi'){throw 'Unexpected Instagram account'}
 $enabled=$false;try{$enabled=(Get-Content 'D:\Apps\HorseRide\data\instagram\agent-config.json' -Raw | ConvertFrom-Json).enabled -eq $true}catch{}
 $status=@{checkedAt=[DateTime]::UtcNow.ToString('o');status='verified';account=$ig.username;appId=$info.data.app_id;instagramId=$ig.id;pageId='1361606213706671';valid=$true;expiresAtUnix=$info.data.expires_at;dataAccessExpiresAtUnix=$info.data.data_access_expires_at;grantedScopes=$info.data.scopes;tokenExpiryVerified=$true;publishEnabled=$enabled;credentialStorage='Windows DPAPI CurrentUser'}
 if($info.data.expires_at -gt 0){$status.expiresAtUTC=[DateTimeOffset]::FromUnixTimeSeconds($info.data.expires_at).UtcDateTime.ToString('o')}
 $status | ConvertTo-Json -Depth 5 | Set-Content 'D:\Apps\HorseRide\data\maintenance\instagram-connection.json' -Encoding UTF8
 $status | ConvertTo-Json -Depth 5
}catch{$code=$null;try{$code=($_.ErrorDetails.Message | ConvertFrom-Json).error.code}catch{};@{phase=$phase;errorType=$_.Exception.GetType().FullName;apiCode=$code} | ConvertTo-Json | Set-Content 'D:\Apps\HorseRide\data\maintenance\instagram-connection-error.json' -Encoding UTF8;Write-Output 'Instagram credential verification failed; no secret details printed.';exit 1}finally{$token=$null;$headers=$null;$secure=$null}
