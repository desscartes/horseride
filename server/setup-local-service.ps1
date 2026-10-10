$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'allow-home-network.ps1')
& (Join-Path $PSScriptRoot 'install-local-service.ps1')
$taskLauncher = Join-Path (Split-Path -Parent $PSScriptRoot) 'Baslat-GanyanZekasi.vbs'
Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + $taskLauncher + '"') -WindowStyle Hidden
Write-Output 'Kurulum tamamlandi. Telefonda ayni Wi-Fi agini kullanin ve Sunucu baglantisi alaninda PC adresini test edin.'
