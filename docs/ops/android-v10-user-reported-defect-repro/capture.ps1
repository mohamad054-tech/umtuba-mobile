# User-reported defect repro capture. Do not write to Desktop.
$ErrorActionPreference = "Continue"
$Out = "C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC\docs\ops\android-v10-user-reported-defect-repro"
$Serial = "RFCX718LVHK"
$Adb = "C:\Users\1\Desktop\umtuba\umtuba-web\tools\android-device-toolchain\platform-tools\adb.exe"
if (-not (Test-Path "$Out\screenshots")) { New-Item -ItemType Directory -Path "$Out\screenshots" | Out-Null }
if (-not (Test-Path "$Out\dumps")) { New-Item -ItemType Directory -Path "$Out\dumps" | Out-Null }
function Adb { & $Adb -s $Serial @args }
function Capture-Qa([string]$Name) {
  Start-Sleep -Milliseconds 700
  $png = Join-Path $Out "screenshots\$Name.png"
  $xml = Join-Path $Out "dumps\$Name-ui.xml"
  $txt = Join-Path $Out "dumps\$Name-texts.txt"
  $nodes = Join-Path $Out "dumps\$Name-nodes.txt"
  Adb shell screencap -p /sdcard/umtuba_qa.png | Out-Null
  Adb pull /sdcard/umtuba_qa.png $png | Out-Null
  Adb shell uiautomator dump /sdcard/window_dump.xml | Out-Null
  Adb pull /sdcard/window_dump.xml $xml | Out-Null
  if (Test-Path $xml) {
    $bytes = [System.IO.File]::ReadAllBytes($xml)
    $raw = [System.Text.Encoding]::UTF8.GetString($bytes)
    $texts = [regex]::Matches($raw, '(?:text|content-desc)="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -and $_.Trim() }
    $texts | Select-Object -Unique | Set-Content -Encoding utf8 $txt
    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($n in [regex]::Matches($raw, '<node[^>]*>')) {
      $v = $n.Value
      $text = if ($v -match 'text="([^"]*)"') { $Matches[1] } else { "" }
      $desc = if ($v -match 'content-desc="([^"]*)"') { $Matches[1] } else { "" }
      $bounds = if ($v -match 'bounds="([^"]+)"') { $Matches[1] } else { "" }
      if ($text -or $desc) { $lines.Add("$text | $desc | $bounds") }
    }
    [System.IO.File]::WriteAllLines($nodes, $lines, [System.Text.UTF8Encoding]::new($false))
  }
  $size = if (Test-Path $png) { (Get-Item $png).Length } else { 0 }
  Write-Host "CAPTURE $Name size=$size"
}
function Get-UiXml {
  $xml = Join-Path $Out "dumps\_live.xml"
  Adb shell uiautomator dump /sdcard/window_dump.xml | Out-Null
  Adb pull /sdcard/window_dump.xml $xml | Out-Null
  return [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($xml))
}
function Find-Center([string]$Xml, [string]$Needle) {
  $esc = [regex]::Escape($Needle)
  foreach ($n in [regex]::Matches($Xml, "<node[^>]*>")) {
    if ($n.Value -notmatch $esc) { continue }
    $b = [regex]::Match($n.Value, 'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
    if ($b.Success) {
      return @{ X = [int]((([int]$b.Groups[1].Value)+([int]$b.Groups[3].Value))/2); Y = [int]((([int]$b.Groups[2].Value)+([int]$b.Groups[4].Value))/2) }
    }
  }
  return $null
}
function Tap-Text([string]$Needle) {
  $xml = Get-UiXml
  $hit = Find-Center $xml $Needle
  if (-not $hit) { Write-Host "TAP_MISS $Needle"; return $false }
  Adb shell input tap $hit.X $hit.Y
  Write-Host "TAP $Needle $($hit.X),$($hit.Y)"
  Start-Sleep -Milliseconds 900
  return $true
}
function Tap-XY([int]$X, [int]$Y) {
  Adb shell input tap $X $Y
  Write-Host "TAP_XY $X,$Y"
  Start-Sleep -Milliseconds 700
}
