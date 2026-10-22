param(
    [string]$ToolRoot = 'C:\Users\desscartes\Documents\Codex\tools\android',
    [string]$VersionName = '1.35',
    [int]$VersionCode = 36,
    [string]$PackageId = 'com.horseride.local',
    [string]$AppName = 'Ganyan Zekası Yeni',
    [switch]$Sign
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path $PSScriptRoot -Parent
$buildRoot = Join-Path $projectRoot '.migration\android-local\project'
$env:JAVA_HOME = (Get-ChildItem $ToolRoot -Directory | Where-Object Name -Like 'jdk-*' | Select-Object -First 1).FullName
if (-not $env:JAVA_HOME) { throw 'Java 21 toolchain missing' }
$env:ANDROID_HOME = Join-Path $ToolRoot 'sdk'
$env:ANDROID_USER_HOME = Join-Path $ToolRoot 'android-user'
New-Item -ItemType Directory -Force $env:ANDROID_USER_HOME | Out-Null
$env:GRADLE_USER_HOME = Join-Path $ToolRoot 'gradle-cache'
# Windows UNIX-domain socket paths have a short length limit. The inherited
# sandbox TEMP can exceed it; use a short, project-owned directory for this JVM.
$jvmTemp = Join-Path $projectRoot '.migration\jvm-tmp'
New-Item -ItemType Directory -Force $jvmTemp | Out-Null
$env:JAVA_TOOL_OPTIONS = '-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE -Djdk.net.unixdomain.tmpdir="' + $jvmTemp + '" -Djava.io.tmpdir="' + $jvmTemp + '"'
New-Item -ItemType Directory -Force $buildRoot | Out-Null
# Build the deployed, reviewed UI. Never invoke the older src Vite build here.
Copy-Item (Join-Path $projectRoot 'android\*') $buildRoot -Recurse -Force
$nativeGradle = Join-Path $buildRoot 'app\build.gradle'
$gradleText = [IO.File]::ReadAllText($nativeGradle)
$gradleText = $gradleText -replace 'versionCode\s+\d+', "versionCode $VersionCode"
$gradleText = $gradleText -replace 'versionName\s+"[^"]+"', "versionName `"$VersionName`""
$gradleText = $gradleText -replace 'applicationId\s+"[^"]+"', "applicationId `"$PackageId`""
[IO.File]::WriteAllText($nativeGradle, $gradleText)
$stringsPath = Join-Path $buildRoot 'app\src\main\res\values\strings.xml'
[xml]$strings = [IO.File]::ReadAllText($stringsPath)
foreach ($item in $strings.resources.string) {
    if ($item.name -in @('app_name','title_activity_main')) { $item.InnerText = $AppName }
    if ($item.name -in @('package_name','custom_url_scheme')) { $item.InnerText = $PackageId }
}
$strings.Save($stringsPath)
$capacitorPath = (Join-Path $projectRoot 'node_modules\@capacitor\android\capacitor').Replace('\','/')
[IO.File]::WriteAllText((Join-Path $buildRoot 'capacitor.settings.gradle'), "include ':capacitor-android'`nproject(':capacitor-android').projectDir = new File('$capacitorPath')`n")
[IO.File]::WriteAllText((Join-Path $buildRoot 'local.properties'), 'sdk.dir=' + $env:ANDROID_HOME.Replace('\','/'))
$assetsRoot = Join-Path $buildRoot 'app\src\main\assets'
$publicRoot = Join-Path $assetsRoot 'public'
if (Test-Path $publicRoot) {
    $resolvedPublic = [IO.Path]::GetFullPath($publicRoot)
    if (-not $resolvedPublic.StartsWith([IO.Path]::GetFullPath($buildRoot) + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging path' }
    Remove-Item -LiteralPath $resolvedPublic -Recurse -Force
}
New-Item -ItemType Directory -Force $publicRoot | Out-Null
Copy-Item (Join-Path $projectRoot 'dist\index.html') $publicRoot
Copy-Item (Join-Path $projectRoot 'dist\assets') $publicRoot -Recurse
Copy-Item (Join-Path $projectRoot 'dist\brand') $publicRoot -Recurse
$config = [IO.File]::ReadAllText((Join-Path $projectRoot 'capacitor.config.json')) | ConvertFrom-Json
$config.appId = $PackageId
$config.appName = $AppName
[IO.File]::WriteAllText((Join-Path $assetsRoot 'capacitor.config.json'), ($config | ConvertTo-Json -Depth 10))
[IO.File]::WriteAllText((Join-Path $assetsRoot 'capacitor.plugins.json'), '[]')
# This step intentionally produces unsigned release output. Signing identity must
# be verified against the installed APK before publishing an in-place update.
Push-Location $buildRoot
try {
    & (Join-Path $ToolRoot 'gradle-8.14.3\bin\gradle.bat') --no-daemon --max-workers=2 assembleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed' }
} finally { Pop-Location }
$apk = Join-Path $buildRoot 'app\build\outputs\apk\release\app-release-unsigned.apk'
if (-not (Test-Path $apk)) { throw 'Expected unsigned APK missing' }
$badging = & (Join-Path $env:ANDROID_HOME 'build-tools\36.0.0\aapt.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or $badging[0] -notmatch "versionCode='$VersionCode' versionName='$([regex]::Escape($VersionName))'") { throw 'APK version verification failed' }
if ($badging[0] -notmatch "name='$([regex]::Escape($PackageId))'") { throw 'APK package verification failed' }
$zip = [IO.Compression.ZipFile]::OpenRead($apk)
try {
    if ($zip.Entries | Where-Object FullName -Like 'assets/public/downloads/*') { throw 'Unexpected embedded APK download archive' }
    $entry = $zip.GetEntry('assets/public/index.html')
    if (-not $entry) { throw 'Missing bundled UI entry' }
    $reader = [IO.StreamReader]::new($entry.Open())
    try { $bundledIndex = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($bundledIndex -ne [IO.File]::ReadAllText((Join-Path $projectRoot 'dist\index.html'))) { throw 'Bundled UI differs from deployed UI' }
} finally { $zip.Dispose() }
Write-Output "Unsigned APK ready: $apk"
if ($Sign) {
    if ($PackageId -ne 'com.horseride.local') { throw 'Local signing key is restricted to com.horseride.local' }
    $signingRoot = Join-Path $ToolRoot 'signing'
    New-Item -ItemType Directory -Force $signingRoot | Out-Null
    $storePath = Join-Path $signingRoot 'horseride-local.p12'
    $passwordPath = Join-Path $signingRoot 'password.dpapi'
    if ((Test-Path $storePath) -and -not (Test-Path $passwordPath)) { throw 'Existing signing key password file missing; do not replace key' }
    if (-not (Test-Path $passwordPath)) {
        $randomPassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
        $securePassword = ConvertTo-SecureString $randomPassword -AsPlainText -Force
        $securePassword | ConvertFrom-SecureString | Set-Content $passwordPath
        $randomPassword = $null
    }
    $securePassword = (Get-Content $passwordPath -Raw).Trim() | ConvertTo-SecureString
    $env:HORSERIDE_SIGNING_PASSWORD = [Net.NetworkCredential]::new('', $securePassword).Password
    try {
        if (-not (Test-Path $storePath)) {
            & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -keystore $storePath -storetype PKCS12 -storepass:env HORSERIDE_SIGNING_PASSWORD -keypass:env HORSERIDE_SIGNING_PASSWORD -alias horseride-local -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 10000 -dname 'CN=Ganyan Zekasi Local' -noprompt
            if ($LASTEXITCODE -ne 0) { throw 'Signing key creation failed' }
        }
        $buildTools = Join-Path $env:ANDROID_HOME 'build-tools\36.0.0'
        $aligned = Join-Path (Split-Path $apk -Parent) 'app-release-aligned.apk'
        $signed = Join-Path (Split-Path $apk -Parent) "GanyanZekasi-Yeni-$VersionName.apk"
        & (Join-Path $buildTools 'zipalign.exe') -P 16 -f 4 $apk $aligned
        if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed' }
        & (Join-Path $buildTools 'apksigner.bat') sign --ks $storePath --ks-key-alias horseride-local --ks-pass env:HORSERIDE_SIGNING_PASSWORD --key-pass env:HORSERIDE_SIGNING_PASSWORD --out $signed $aligned
        if ($LASTEXITCODE -ne 0) { throw 'APK signing failed' }
        $verificationOutput = & (Join-Path $buildTools 'apksigner.bat') verify --verbose --print-certs $signed
        if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
        $verificationOutput | Write-Output
        $certificateMatch = [regex]::Match(($verificationOutput -join "`n"), 'Signer #1 certificate SHA-256 digest: ([a-fA-F0-9]+)')
        if (-not $certificateMatch.Success) { throw 'Cannot determine APK signing identity' }
        $certificateDigest = $certificateMatch.Groups[1].Value.ToLower()
        $identityPath = Join-Path $signingRoot 'identity.json'
        if (Test-Path $identityPath) {
            $identity = Get-Content $identityPath -Raw | ConvertFrom-Json
            if ($identity.certificateSha256 -ne $certificateDigest) { throw 'Signing identity changed; do not publish APK' }
        } else {
            @{ packageId=$PackageId; certificateSha256=$certificateDigest; createdAt=(Get-Date).ToString('o') } | ConvertTo-Json | Set-Content $identityPath
        }
        & (Join-Path $buildTools 'zipalign.exe') -c -P 16 4 $signed
        if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed' }
        Write-Output "Signed APK ready: $signed"
    } finally { Remove-Item Env:HORSERIDE_SIGNING_PASSWORD -ErrorAction SilentlyContinue }
}
