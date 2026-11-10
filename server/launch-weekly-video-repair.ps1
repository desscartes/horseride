$ErrorActionPreference='Stop'
$root='D:\Apps\HorseRide'
$log=Join-Path $root 'data\maintenance\weekly-video-visible-repair.log'
try {
 $who=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
 if(-not $who.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){
  Write-Host 'Windows yonetici onayi bu uzak masaustu oturumunda acilacak.'
  $p=Start-Process -FilePath 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $root 'server\launch-weekly-video-repair.ps1')) -Verb RunAs -WindowStyle Normal -Wait -PassThru
  exit $p.ExitCode
 }
 Start-Transcript -LiteralPath $log -Append|Out-Null
 Write-Host 'HorseRide: yalniz mevcut haftalik video gorevi onariliyor.'
 & (Join-Path $root 'server\repair-weekly-video-task.ps1')
 $result=Get-Content -LiteralPath (Join-Path $root 'data\maintenance\weekly-video-install.json') -Raw|ConvertFrom-Json
 if($result.revision -ne 4 -or $result.status -ne 'configured'){throw 'Gorev onarimi dogrulanamadi.'}
 Write-Host 'BASARILI: gorev izinleri duzeltildi, yalniz GPU testi baslatildi.' -ForegroundColor Green
 Write-Host 'Video yayinlanmadi. Bilgisayar yeniden baslatilmayacak.'
 Stop-Transcript|Out-Null
 [void](Read-Host 'Pencereyi kapatmak icin Enter')
 exit 0
} catch {
 $message=$_.Exception.Message
 try { @{status='failed';stage='visible_permission_repair';error=$message;checkedAt=[datetime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'data\maintenance\weekly-video-visible-repair-error.json') -Encoding utf8 } catch {}
 Write-Host ('ISLEM TAMAMLANMADI: '+$message) -ForegroundColor Red
 Write-Host ('Kayit: '+$log)
 try {Stop-Transcript|Out-Null}catch{}
 [void](Read-Host 'Pencereyi kapatmak icin Enter')
 exit 1
}
