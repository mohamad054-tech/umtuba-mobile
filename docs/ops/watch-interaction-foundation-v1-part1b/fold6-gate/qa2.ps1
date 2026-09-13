param(
  [Parameter(Mandatory = $true)][string]$Action,
  [string]$Serial = "RFCX718LVHK",
  [string]$Root = "C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1\docs\ops\watch-interaction-foundation-v1-part1b\fold6-gate"
)

function Shot([string]$name) {
  adb -s $Serial shell screencap -p /sdcard/umtuba-1b.png
  adb -s $Serial pull /sdcard/umtuba-1b.png "$Root\$name.png" | Out-Null
  Write-Host "SHOT $name $((Get-Item "$Root\$name.png").Length)"
}

function DumpUi([string]$name) {
  adb -s $Serial shell uiautomator dump /sdcard/umtuba-ui.xml 2>$null
  adb -s $Serial pull /sdcard/umtuba-ui.xml "$Root\$name.xml" | Out-Null
  $env:PYTHONIOENCODING = "utf-8"
  python "$Root\parse_ui.py" "$Root\$name.xml" | Out-File "$Root\$name-labels.txt" -Encoding utf8
  Write-Host "UI $name"
  Get-Content "$Root\$name-labels.txt"
}

switch ($Action) {
  "single-pause" {
    adb -s $Serial shell input tap 480 1050
    Start-Sleep -Milliseconds 350
    Shot "07-single-pause"
    DumpUi "07-single-pause"
  }
  "single-play" {
    adb -s $Serial shell input tap 480 1050
    Start-Sleep -Milliseconds 350
    Shot "08-single-play"
    DumpUi "08-single-play"
  }
  "swipe-up" {
    adb -s $Serial shell input swipe 480 1600 480 500 280
    Start-Sleep -Seconds 2
    Shot "09-swipe-up"
    DumpUi "09-swipe-up"
  }
  "swipe-down" {
    adb -s $Serial shell input swipe 480 600 480 1700 280
    Start-Sleep -Seconds 2
    Shot "10-swipe-down"
    DumpUi "10-swipe-down"
  }
}
