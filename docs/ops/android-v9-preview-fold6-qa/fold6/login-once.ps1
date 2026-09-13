# Device login helper. Does not print the password.
$ErrorActionPreference = "Continue"
$AdbBin = "C:\Users\1\Desktop\umtuba\umtuba-web\tools\android-device-toolchain\platform-tools\adb.exe"
$Serial = "RFCX718LVHK"
function Adb { & $AdbBin -s $Serial @args }

$envFile = "C:\Users\1\Desktop\umtuba\umtuba-mobile\.env.play-review.local"
$email = $null
$password = $null
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^PLAY_LOGIN_USERNAME=(.+)$') { $script:email = $Matches[1].Trim() }
  if ($_ -match '^PLAY_LOGIN_PASSWORD=(.+)$') { $script:password = $Matches[1].Trim() }
}
if (-not $email -or -not $password) {
  Write-Output "CREDS_MISSING"
  exit 1
}
Write-Output "LOGIN_EMAIL_LEN=$($email.Length) LOGIN_PASS_LEN=$($password.Length)"

Adb shell am start -W -n com.umtuba.app/.MainActivity | Out-Null
Start-Sleep -Seconds 2

# Focus email, type with escaped @
Adb shell input tap 484 754
Start-Sleep -Milliseconds 400
$escapedEmail = ($email -replace '@', '\@')
Adb shell input text $escapedEmail
Start-Sleep -Milliseconds 500

Adb shell input tap 484 940
Start-Sleep -Milliseconds 400
Adb shell input text $password
Start-Sleep -Milliseconds 400

Adb shell input tap 484 1235
Start-Sleep -Seconds 8
Write-Output "LOGIN_SUBMITTED"
