# Fold6 v9 localization QA capture helper. Do not write to Desktop.
$ErrorActionPreference = "Continue"
$Out = "C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC\docs\ops\android-v9-preview-fold6-qa\fold6"
$Serial = "RFCX718LVHK"
$Adb = "C:\Users\1\Desktop\umtuba\umtuba-web\tools\android-device-toolchain\platform-tools\adb.exe"
function Adb { & $Adb -s $Serial @args }
function Capture-Qa([string]$Name) {
  Start-Sleep -Milliseconds 700
  $png = Join-Path $Out "$Name.png"
  $xml = Join-Path $Out "$Name-ui.xml"
  Adb shell screencap -p /sdcard/umtuba_qa.png | Out-Null
  Adb pull /sdcard/umtuba_qa.png $png | Out-Null
  Adb shell uiautomator dump /sdcard/window_dump.xml | Out-Null
  Adb pull /sdcard/window_dump.xml $xml | Out-Null
  $size = if (Test-Path $png) { (Get-Item $png).Length } else { 0 }
  Write-Host "CAPTURE $Name size=$size"
}
function Get-UiXml {
  $xml = Join-Path $Out "_live.xml"
  Adb shell uiautomator dump /sdcard/window_dump.xml | Out-Null
  Adb pull /sdcard/window_dump.xml $xml | Out-Null
  return Get-Content -Raw $xml
}
function Get-BoundsCenter([string]$Bounds) {
  if ($Bounds -match '\[(\d+),(\d+)\]\[(\d+),(\d+)\]') {
    $x = [int]((([int]$Matches[1]) + ([int]$Matches[3])) / 2)
    $y = [int]((([int]$Matches[2]) + ([int]$Matches[4])) / 2)
    return @{ X = $x; Y = $y; Bounds = $Bounds }
  }
  return $null
}
function Find-Node([string]$Xml, [string]$Needle) {
  $esc = [regex]::Escape($Needle)
  $m = [regex]::Match($Xml, "(<node[^>]*((content-desc|text)=`"$esc`")[^>]*>)", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $m.Success) { return $null }
  $bounds = [regex]::Match($m.Value, 'bounds="(\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\])"')
  if (-not $bounds.Success) { return $null }
  return Get-BoundsCenter $bounds.Groups[1].Value
}
function Find-NodeContains([string]$Xml, [string]$Needle) {
  $esc = [regex]::Escape($Needle)
  $m = [regex]::Match($Xml, "(<node[^>]*((content-desc|text)=`"[^`"]*$esc[^`"]*`")[^>]*>)", [System.Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $m.Success) { return $null }
  $bounds = [regex]::Match($m.Value, 'bounds="(\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\])"')
  if (-not $bounds.Success) { return $null }
  return Get-BoundsCenter $bounds.Groups[1].Value
}
function Tap-Desc([string]$Desc) {
  $xml = Get-UiXml
  $hit = Find-Node $xml $Desc
  if (-not $hit) { $hit = Find-NodeContains $xml $Desc }
  if (-not $hit) { Write-Host "TAP_MISS $Desc"; return $false }
  Adb shell input tap $hit.X $hit.Y
  Write-Host "TAP $Desc $($hit.X),$($hit.Y) $($hit.Bounds)"
  Start-Sleep -Milliseconds 900
  return $true
}
function Tap-XY([int]$X, [int]$Y) {
  Adb shell input tap $X $Y
  Write-Host "TAP_XY $X,$Y"
  Start-Sleep -Milliseconds 700
}
function Has-Text([string]$Xml, [string]$Needle) {
  return $Xml.Contains($Needle)
}
function Launch-App {
  Adb shell am force-stop com.umtuba.app | Out-Null
  Start-Sleep -Milliseconds 500
  Adb shell monkey -p com.umtuba.app -c android.intent.category.LAUNCHER 1 | Out-Null
  Start-Sleep -Seconds 4
}
function Key-Back { Adb shell input keyevent 4; Start-Sleep -Milliseconds 700 }
function Key-Home { Adb shell input keyevent 3; Start-Sleep -Milliseconds 500 }
