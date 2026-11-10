param(
 [string]$CredentialPath=(Join-Path $env:LOCALAPPDATA 'HorseRide\azure-speech.dpapi.json'),
 [string]$SsmlPath=(Join-Path $PSScriptRoot 'story.ssml'),
 [string]$OutputPath=(Join-Path $PSScriptRoot 'azure-narration.wav'),
 [string]$PreviewVoice,
 [string]$NarrationDay,
 [switch]$DescribeVoice,
 [string]$PolicyPath,
 [string]$UsageDirectory
)
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSHOME 'Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$root=$PSScriptRoot
if(-not $PolicyPath){$PolicyPath=Join-Path $root 'azure-policy.json'}
$policy=Get-Content -LiteralPath $PolicyPath -Raw -Encoding UTF8 | ConvertFrom-Json
if(-not $UsageDirectory){$UsageDirectory=if($policy.sharedUsageDirectory){$policy.sharedUsageDirectory}else{$root}}
if(-not (Test-Path -LiteralPath $UsageDirectory)){New-Item -ItemType Directory -Path $UsageDirectory -Force|Out-Null}
# This engine must remain inactive until the actual resource tier is checked in Azure.
if(-not $policy.enabled -or $policy.verifiedSku -ne 'F0' -or -not $policy.resourceId){throw 'Azure F0 kaynağı henüz doğrulanmadı; ses isteği gönderilmedi.'}
if($policy.voice -notin @('tr-TR-AhmetNeural','tr-TR-EmelNeural','en-US-AndrewMultilingualNeural')){throw 'Yalnız standart Türkçe Neural seslere izin veriliyor.'}
$selectedVoice=$policy.voice
$selectedDay=$null
if($policy.voiceMode -eq 'alternate-native-daily'){
 if(-not $NarrationDay){$NarrationDay=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow,'Turkey Standard Time').ToString('yyyy-MM-dd')}
 $culture=[Globalization.CultureInfo]::InvariantCulture
 $plannedDay=[datetime]::ParseExact($NarrationDay,'yyyy-MM-dd',$culture).Date
 $anchor=[datetime]::ParseExact($policy.voiceCalendar.anchorDay,'yyyy-MM-dd',$culture).Date
 if($policy.voiceCalendar.timezone -ne 'Europe/Istanbul' -or $policy.voiceCalendar.anchorVoice -ne 'tr-TR-AhmetNeural'){throw 'Günlük anlatıcı takvimi geçersiz.'}
 $selectedDay=$plannedDay.ToString('yyyy-MM-dd')
 $selectedVoice=if((($plannedDay-$anchor).Days%2) -eq 0){'tr-TR-AhmetNeural'}else{'tr-TR-EmelNeural'}
}
if($PreviewVoice){
 if(-not $policy.previewOnly -or $PreviewVoice -notin @('tr-TR-AhmetNeural','tr-TR-EmelNeural','en-US-AndrewMultilingualNeural')){throw 'Önizleme sesi izin verilen standart seslerden biri olmalı.'}
 $selectedVoice=$PreviewVoice
}
if($policy.rejectedVoices -and $selectedVoice -in @($policy.rejectedVoices)){throw 'Kullanıcı tarafından reddedilen anlatıcıyla yeni ses üretimi kapatıldı; Türkçe önizleme sesi seçilmeli.'}
if($DescribeVoice){@{voice=$selectedVoice;day=$selectedDay;mode=$policy.voiceMode;timezone='Europe/Istanbul'}|ConvertTo-Json;return}
$config=Get-Content -LiteralPath $CredentialPath -Raw|ConvertFrom-Json
if($config.resourceId -ne $policy.resourceId -or $config.region -notmatch '^[a-z0-9]+$'){throw 'Kaynak kimliği veya bölge eşleşmedi.'}
$ssml=[IO.File]::ReadAllText($SsmlPath)
if([int]$policy.monthlyCharacterCap -lt 1 -or [int]$policy.monthlyCharacterCap -gt 100000){throw 'Deneme kotası sınırı geçersiz.'}
$settings=[Xml.XmlReaderSettings]::new();$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
$reader=[Xml.XmlReader]::Create([IO.StringReader]::new($ssml),$settings)
try{$xml=[Xml.XmlDocument]::new();$xml.XmlResolver=$null;$xml.Load($reader)}finally{$reader.Dispose()}
$voices=$xml.GetElementsByTagName('voice')
if($voices.Count -ne 1 -or $voices[0].GetAttribute('name') -ne $selectedVoice -or $xml.GetElementsByTagName('audio').Count){throw 'SSML ses politikasıyla eşleşmedi.'}
$month=Get-Date -Format 'yyyy-MM';$ledgerPath=Join-Path $UsageDirectory ('azure-usage-'+$month+'.json')
$ledger=@{month=$month;reserved=0}
if(Test-Path -LiteralPath $ledgerPath){$ledger=Get-Content -LiteralPath $ledgerPath -Raw|ConvertFrom-Json}
# Count the entire SSML conservatively, and reserve failed attempts as well.
if([int]$ledger.reserved+$ssml.Length -gt [int]$policy.monthlyCharacterCap){throw 'Yerel aylık kota doldu; istek gönderilmedi.'}
$lockPath=Join-Path $UsageDirectory 'azure-speech.lock'
$lock=[IO.File]::Open($lockPath,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
try{
 # Re-read inside the lock to avoid two renderers exceeding the quota together.
 if(Test-Path -LiteralPath $ledgerPath){$ledger=Get-Content -LiteralPath $ledgerPath -Raw|ConvertFrom-Json}
 if([int]$ledger.reserved+$ssml.Length -gt [int]$policy.monthlyCharacterCap){throw 'Yerel aylık kota doldu.'}
 $ledger.reserved=[int]$ledger.reserved+$ssml.Length
 $ledger|ConvertTo-Json|Set-Content -LiteralPath $ledgerPath -Encoding UTF8
 $secure=$config.key|ConvertTo-SecureString
 $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try{
  $key=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $headers=@{'Ocp-Apim-Subscription-Key'=$key;'X-Microsoft-OutputFormat'='riff-24khz-16bit-mono-pcm';'User-Agent'='HorseRide-History-Preview'}
  Invoke-WebRequest -Uri ('https://'+$config.region+'.tts.speech.microsoft.com/cognitiveservices/v1') -Method Post -Headers $headers -ContentType 'application/ssml+xml' -Body ([Text.Encoding]::UTF8.GetBytes($ssml)) -OutFile $OutputPath -TimeoutSec 90 | Out-Null
 }finally{
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$key=$null;$headers=$null
 }
 $renderReport=@{engine='Azure Speech';voice=$selectedVoice;day=$selectedDay;sku='F0';status='preview_only';published=$false;reservedCharacters=$ssml.Length}
 $renderReport|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'azure-report.json') -Encoding UTF8
 $renderReport|ConvertTo-Json|Set-Content -LiteralPath ([IO.Path]::ChangeExtension($OutputPath,'.report.json')) -Encoding UTF8
}finally{$lock.Dispose()}
