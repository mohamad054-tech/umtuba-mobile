param(
  [Parameter(Mandatory = $true)][string]$Action,
  [string]$Serial = "RFCX718LVHK",
  [string]$Root = "C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1\docs\ops\watch-interaction-foundation-v1-part1b\fold6-gate"
)

function Shot([string]$name) {
  adb -s $Serial shell screencap -p /sdcard/umtuba-1b.png
  adb -s $Serial pull /sdcard/umtuba-1b.png "$Root\$name.png" | Out-Null
  $len = (Get-Item "$Root\$name.png").Length
  Write-Host "SHOT $name $len"
}

function DumpUi([string]$name) {
  adb -s $Serial shell uiautomator dump /sdcard/umtuba-ui.xml 2>$null
  adb -s $Serial pull /sdcard/umtuba-ui.xml "$Root\$name.xml" | Out-Null
  $env:PYTHONIOENCODING = "utf-8"
  python "$Root\parse_ui.py" "$Root\$name.xml" | Out-File "$Root\$name-labels.txt" -Encoding utf8
  Write-Host "UI $name"
  Get-Content "$Root\$name-labels.txt"
}

function DoubleTap([int]$x, [int]$y) {
  adb -s $Serial shell input tap $x $y
  adb -s $Serial shell input tap $x $y
}

switch ($Action) {
  "double-like" {
    adb -s $Serial logcat -c
    Write-Host "HEART_BEFORE"
    DumpUi "03-before-like"
    DoubleTap 480 1050
    Shot "03-like-ack"
    Start-Sleep -Milliseconds 400
    Shot "04-after-like"
    DumpUi "04-after-like"
  }
  "double-again" {
    DoubleTap 480 1050
    Start-Sleep -Milliseconds 500
    Shot "05-already-liked"
    DumpUi "05-already-liked"
  }
  "rapid" {
    1..4 | ForEach-Object { DoubleTap 480 1050; Start-Sleep -Milliseconds 80 }
    Start-Sleep -Milliseconds 600
    Shot "06-rapid"
    DumpUi "06-rapid"
  }
  default { Write-Host "unknown $Action" }
}
