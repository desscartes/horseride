$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$credentialDirectory=Join-Path $env:LOCALAPPDATA 'HorseRide\Instagram'
$credentialPath=Join-Path $credentialDirectory 'user-token.dpapi'
$statusPath='D:\Apps\HorseRide\data\maintenance\instagram-connection.json'
$form=New-Object Windows.Forms.Form
$form.Text='Ganyan Zekasi - Instagram baglantisi'
$form.Size=New-Object Drawing.Size(590,260)
$form.StartPosition='CenterScreen'
$form.ShowInTaskbar=$true
$form.TopMost=$true
$form.Add_Shown({$form.Show();$form.Activate();$field.Focus()})
$label=New-Object Windows.Forms.Label
$label.Text='Graph API Explorer tokenini asagiya yapistir. Deger gizlenir ve yalniz bu Windows kullanicisi icin sifreli saklanir. Sohbete gonderme. Bu islem paylasim yapmaz.'
$label.Location=New-Object Drawing.Point(20,15)
$label.Size=New-Object Drawing.Size(540,55)
$field=New-Object Windows.Forms.TextBox
$field.Location=New-Object Drawing.Point(20,80)
$field.Width=530
$field.UseSystemPasswordChar=$true
$button=New-Object Windows.Forms.Button
$button.Text='Baglantiyi kontrol et ve kaydet'
$button.Location=New-Object Drawing.Point(20,125)
$button.Size=New-Object Drawing.Size(300,32)
$status=New-Object Windows.Forms.Label
$status.Location=New-Object Drawing.Point(20,170)
$status.Size=New-Object Drawing.Size(535,45)
$button.Add_Click({
 $button.Enabled=$false
 $status.Text='Hesap ve izinler kontrol ediliyor...'
 $form.Refresh()
 try {
  $setupStage='input'
  $token=$field.Text.Trim()
  if($token.Length -lt 30 -or $token -match '\s'){throw 'invalid_input'}
  $headers=@{Authorization=('Bearer '+$token)}
  $setupStage='permissions'
  $permissions=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/me/permissions' -Headers $headers -TimeoutSec 20
  $granted=@($permissions.data | Where-Object {$_.status -eq 'granted'} | ForEach-Object {$_.permission})
  foreach($scope in @('instagram_basic','instagram_content_publish','pages_show_list','pages_read_engagement')){if($scope -notin $granted){throw 'missing_permission'}}
  $setupStage='account_lookup'
  $uri='https://graph.facebook.com/v26.0/me/accounts?fields=id,name,instagram_business_account%7Bid,username%7D&limit=100'
  $accounts=Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 20
  $pages=@($accounts.data)
  $page=@($pages | Where-Object {$_.id -eq '1361606213706671'})
  $diagnostic=@{checkedAt=[DateTime]::UtcNow.ToString('o');status='checking';pageCount=$pages.Count;expectedPageFound=($page.Count -eq 1);instagramAccountSeen=$false;usernameMatched=$false;publishEnabled=$false}
  if($page.Count -eq 0){
   try{$direct=Invoke-RestMethod -Uri 'https://graph.facebook.com/v26.0/1361606213706671?fields=id,name,instagram_business_account%7Bid,username%7D' -Headers $headers -TimeoutSec 20;if($direct.id -eq '1361606213706671'){$page=@($direct);$diagnostic.expectedPageFound=$true;$diagnostic.directPageLookup=$true}}catch{}
  }
  if($page.Count -eq 1 -and $page[0].instagram_business_account.id){
   $diagnostic.instagramAccountSeen=$true
   if(-not $page[0].instagram_business_account.username){
    try{$ig=Invoke-RestMethod -Uri ('https://graph.facebook.com/v26.0/'+$page[0].instagram_business_account.id+'?fields=id,username') -Headers $headers -TimeoutSec 20;$page[0].instagram_business_account=$ig}catch{}
   }
   $diagnostic.usernameMatched=($page[0].instagram_business_account.username -eq 'ganyan_zekasi')
  }
  $diagnostic.status='identity_check'
  $diagnostic | ConvertTo-Json | Set-Content -LiteralPath 'D:\Apps\HorseRide\data\maintenance\instagram-connection-diagnostic.json' -Encoding UTF8
  $target=@($page | Where-Object {$_.id -eq '1361606213706671' -and $_.instagram_business_account.username -eq 'ganyan_zekasi' -and $_.instagram_business_account.id -eq '17841441483231653'})
  if($target.Count -ne 1){throw 'target_account_not_found'}
  $setupStage='local_directory'
  New-Item -ItemType Directory -Path $credentialDirectory -Force | Out-Null
  $setupStage='local_acl'
  $acl=Microsoft.PowerShell.Security\Get-Acl -LiteralPath $credentialDirectory
  $acl.SetAccessRuleProtection($true,$false)
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $inherit=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
  foreach($principal in @($identity,'SYSTEM')){$rule=New-Object Security.AccessControl.FileSystemAccessRule($principal,'FullControl',$inherit,'None','Allow');$acl.AddAccessRule($rule)}
  Microsoft.PowerShell.Security\Set-Acl -LiteralPath $credentialDirectory -AclObject $acl
  $setupStage='encryption'
  $secure=ConvertTo-SecureString -String $token -AsPlainText -Force
  $encrypted=ConvertFrom-SecureString -SecureString $secure
  $setupStage='encrypted_file'
  [IO.File]::WriteAllText($credentialPath,$encrypted)
  $setupStage='status_file'
  @{checkedAt=[DateTime]::UtcNow.ToString('o');account='ganyan_zekasi';pageId=$target[0].id;instagramId=$target[0].instagram_business_account.id;readOnlyVerification=$true;publishEnabled=$false;credentialStorage='Windows DPAPI CurrentUser';tokenExpiryVerified=$false;status='verified'} | ConvertTo-Json | Set-Content -LiteralPath $statusPath -Encoding UTF8
  $field.Clear();$field.Enabled=$false
  $status.Text='BASARILI: ganyan_zekasi dogrulandi. Token sifreli kaydedildi. Otomatik yayin henuz kapali. Bu pencereyi kapatabilirsin.'
 } catch {
  @{checkedAt=[DateTime]::UtcNow.ToString('o');stage=$setupStage;errorType=$_.Exception.GetType().FullName;hresult=$_.Exception.HResult;line=$_.InvocationInfo.ScriptLineNumber;publishEnabled=$false} | ConvertTo-Json | Set-Content -LiteralPath 'D:\Apps\HorseRide\data\maintenance\instagram-setup-failure.json' -Encoding UTF8
  $kind=$_.Exception.Message
  $message=switch($kind){'invalid_input' {'Token bos veya bicimi gecersiz.'} 'missing_permission' {'Gerekli yayin/hesap izinlerinden biri eksik.'} 'target_account_not_found' {'Hesap eslesmedi. Ayrintili guvenli tani raporu kaydedildi; sohbetten devam edelim.'} default {'Baglanti dogrulanamadi. Token suresi, ag veya Meta yetkisini kontrol edecegiz.'}}
  $status.Text=$message+' Asama: '+$setupStage+'. Token kaydi tamamlanmadi.'
 } finally {$token=$null;$secure=$null;$encrypted=$null;$headers=$null;$button.Enabled=$field.Enabled}
})
$form.Controls.AddRange(@($label,$field,$button,$status))
[void]$form.ShowDialog()
