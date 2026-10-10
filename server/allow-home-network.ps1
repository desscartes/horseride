# Run once from an elevated PowerShell if Windows denies updating firewall rules.
$ErrorActionPreference = 'Stop'
$taskFirewall = New-Object -ComObject HNetCfg.FwPolicy2
$taskRuleName = 'Ganyan Zekasi API - Local Subnet'
try { $taskFirewall.Rules.Item($taskRuleName) | Out-Null; Write-Output 'Yerel ag kurali zaten mevcut.'; return } catch {}
$taskRule = New-Object -ComObject HNetCfg.FwRule
$taskRule.Name = $taskRuleName
$taskRule.Description = 'Yalnizca ayni yerel agdan telefonun Ganyan Zekasi servisine erisimi.'
$taskRule.Protocol = 6
$taskRule.LocalPorts = '8788'
$taskRule.RemoteAddresses = 'LocalSubnet'
$taskRule.Direction = 1
$taskRule.Action = 1
$taskRule.Profiles = 7
$taskRule.Enabled = $true
$taskFirewall.Rules.Add($taskRule)
Write-Output '8788 TCP icin yalnizca yerel alt ag erisim kurali eklendi.'
