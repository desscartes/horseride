$ErrorActionPreference='Stop'
$root='D:\Apps\HorseRide'
$names=@('HorseRide-Instagram-Agent','HorseRide-Intraday-Collection','HorseRide-Morning-Preparation','HorseRide-Nightly-Model-Training','HorseRide-Public-Watchdog','HorseRide-Commentary-Watchdog')
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$report=Join-Path $root 'data\maintenance\unattended-setup.json'
$cred=$null;$plain=$null;$ptr=[IntPtr]::Zero;$done=@()
try {
  # Windows prompts locally; no password is logged, written to a file or sent to Codex.
  $cred=$Host.UI.PromptForCredential('Ganyan Zekası — oturum kapalı çalışma','Windows hesap parolanızı girin. PIN değil. Parola yalnız Windows Görev Zamanlayıcısına aktarılır.',$user,'')
  if(-not $cred){throw 'credential_entry_cancelled'}
  if($cred.UserName -ne $user -and $cred.UserName -ne $env:USERNAME){throw 'different_account_not_allowed'}
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($cred.Password)
  $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  foreach($name in $names){
    $task=Get-ScheduledTask -TaskName $name -ErrorAction Stop
    [xml]$xml=Export-ScheduledTask -TaskName $name
    $ns=New-Object Xml.XmlNamespaceManager($xml.NameTable);$ns.AddNamespace('t',$xml.DocumentElement.NamespaceURI)
    $principal=$xml.SelectSingleNode('//t:Principal',$ns)
    $principal.UserId=$user;$principal.LogonType='Password'
    $settings=$xml.SelectSingleNode('//t:Settings',$ns)
    foreach($pair in @(@('StartWhenAvailable','true'),@('WakeToRun','true'))){
      $node=$settings.SelectSingleNode('t:'+$pair[0],$ns)
      if(-not $node){$node=$xml.CreateElement($pair[0],$xml.DocumentElement.NamespaceURI);[void]$settings.AppendChild($node)}
      $node.InnerText=$pair[1]
    }
    if($name -in @('HorseRide-Instagram-Agent','HorseRide-Intraday-Collection','HorseRide-Public-Watchdog','HorseRide-Commentary-Watchdog')){
      $triggers=$xml.SelectSingleNode('//t:Triggers',$ns)
      if(-not $triggers.SelectSingleNode('t:BootTrigger',$ns)){
        $boot=$xml.CreateElement('BootTrigger',$xml.DocumentElement.NamespaceURI)
        $enabled=$xml.CreateElement('Enabled',$xml.DocumentElement.NamespaceURI);$enabled.InnerText='true';[void]$boot.AppendChild($enabled)
        $delay=$xml.CreateElement('Delay',$xml.DocumentElement.NamespaceURI);$delay.InnerText='PT90S';[void]$boot.AppendChild($delay)
        [void]$triggers.AppendChild($boot)
      }
    }
    Register-ScheduledTask -TaskName $name -Xml $xml.OuterXml -User $user -Password $plain -Force | Out-Null
    $updated=Get-ScheduledTask -TaskName $name
    if($updated.Principal.LogonType -ne 'Password'){throw 'task_principal_not_updated'}
    $done+=$name
  }
  @{status='configured';checkedAt=[datetime]::UtcNow.ToString('o');tasks=$done;credentialStoredBy='Windows Task Scheduler';sameWindowsAccount=$true} | ConvertTo-Json | Set-Content -LiteralPath $report -Encoding UTF8
  Start-ScheduledTask -TaskName 'HorseRide-Instagram-Agent'
} catch {
  @{status='attention_required';checkedAt=[datetime]::UtcNow.ToString('o');configuredTasks=$done;errorType=$_.Exception.GetType().Name;code=$_.Exception.HResult} | ConvertTo-Json | Set-Content -LiteralPath $report -Encoding UTF8
} finally {
  $plain=$null;$cred=$null
  if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
}
