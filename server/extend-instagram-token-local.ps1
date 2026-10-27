$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$path=Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram\user-token.dpapi'
$form=New-Object Windows.Forms.Form
$form.Text='Ganyan Zekasi - Uzun sureli Instagram baglantisi'
$form.Size=New-Object Drawing.Size(600,270)
$form.StartPosition='CenterScreen';$form.TopMost=$true
$label=New-Object Windows.Forms.Label
$label.Text='Meta uygulamasi App settings > Basic > App secret degerini buraya yapistir. Sohbete gonderme. Anahtar yalniz token degisimi icin kullanilir; kaydedilmez.'
$label.Location=New-Object Drawing.Point(20,15);$label.Size=New-Object Drawing.Size(540,60)
$field=New-Object Windows.Forms.TextBox
$field.Location=New-Object Drawing.Point(20,80);$field.Width=540;$field.UseSystemPasswordChar=$true
$button=New-Object Windows.Forms.Button
$button.Text='Uzun sureli baglantiyi kur';$button.Location=New-Object Drawing.Point(20,125);$button.Size=New-Object Drawing.Size(300,35)
$status=New-Object Windows.Forms.Label
$status.Location=New-Object Drawing.Point(20,175);$status.Size=New-Object Drawing.Size(540,45)
$button.Add_Click({
 $button.Enabled=$false;$status.Text='Baglanti suresi uzatiliyor...';$form.Refresh()
 try{
  $secret=$field.Text.Trim();if($secret -notmatch '^[a-fA-F0-9]{32}$'){throw 'Invalid app secret format'}
  $old=[Net.NetworkCredential]::new('',(ConvertTo-SecureString ([IO.File]::ReadAllText($path)))).Password
  $uri='https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=3087033018311346&client_secret='+[uri]::EscapeDataString($secret)+'&fb_exchange_token='+[uri]::EscapeDataString($old)
  $response=Invoke-RestMethod -Uri $uri -TimeoutSec 30
  $new=$response.access_token;if(-not $new){throw 'Missing exchanged token'}
  $headers=@{Authorization=('Bearer '+$new)}
  $debug=Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/debug_token?input_token='+[uri]::EscapeDataString($new)) -Headers $headers -TimeoutSec 25
  if(-not $debug.data.is_valid -or $debug.data.app_id -ne '3087033018311346' -or $debug.data.expires_at -lt [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()+86400){throw 'Extended token not verified'}
  $ig=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/17841441483231653?fields=id,username' -Headers $headers -TimeoutSec 25
  if($ig.username -ne 'ganyan_zekasi'){throw 'Account mismatch'}
  $encrypted=ConvertFrom-SecureString (ConvertTo-SecureString $new -AsPlainText -Force)
  [IO.File]::WriteAllText($path+'.tmp',$encrypted)
  Move-Item -LiteralPath ($path+'.tmp') -Destination $path -Force
  $state=Get-Content 'D:\Apps\HorseRide\data\maintenance\instagram-connection.json' -Raw | ConvertFrom-Json
  $state.expiresAtUnix=$debug.data.expires_at;$state.expiresAtUTC=[DateTimeOffset]::FromUnixTimeSeconds($debug.data.expires_at).UtcDateTime.ToString('o');$state.checkedAt=[DateTime]::UtcNow.ToString('o');$state.tokenExpiryVerified=$true
  $state | ConvertTo-Json -Depth 5 | Set-Content 'D:\Apps\HorseRide\data\maintenance\instagram-connection.json' -Encoding UTF8
  $field.Clear();$field.Enabled=$false;$status.Text='BASARILI: Uzun sureli token dogrulandi ve sifreli kaydedildi. App secret kaydedilmedi.'
 }catch{$status.Text='Islem tamamlanamadi; onceki token korundu. App secret ve yetkiyi kontrol edecegiz.'}
 finally{$secret=$null;$old=$null;$new=$null;$headers=$null;$response=$null;$uri=$null;$encrypted=$null;$button.Enabled=$field.Enabled}
})
$form.Controls.AddRange(@($label,$field,$button,$status));$form.Add_Shown({$form.Activate();$field.Focus()});[void]$form.ShowDialog()
