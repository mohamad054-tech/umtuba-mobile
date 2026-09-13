# CURRENT TASK — DESKTOP_ANDROID_WATCH_AUTO_ADVANCE_QA_V1

## Status

`AUTO_ADVANCE_PASS` — Android V3 `READY_FOR_CENTRAL_REVIEW`

## Task

Targeted auto-advance QA only on the already-installed Fold6 V3 build. No product changes. No Play upload.

## Authoritative source

- Isolated worktree: `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-WATCH-NEXT-VIDEO-TRANSITION-DELAY-V1`
- SOURCE_SHA: `1a4b0f8b41ff388b99ffb136bbc39156d841e52f`
- BUILD_SHA: `da449c9e9f3c4c0371ecdd2999220b4f69ae4ec5`
- EAS preview: `6bc060ed-b9fe-4697-b8a3-062be8f52973`

## Allowed scope

- Device QA / ADB / UI seek of existing SeekBar
- Isolated docs: `CURSOR_REPORT.md`, this file, `docs/ops/`

## Forbidden scope

- Product Watch behavior changes
- Play upload / deploy
- Web / iOS / Globe / Learning / Store / DB / payments
- Parent web `380a366`, dirty mobile parent
- Desktop writes, `_port_extract`

## Isolation notes

- 3 auto end→next observed (1 UI-seek + 2 short natural). Median gap 68ms.
- PLAY_UPLOAD=NO. versionCode Play fix still required (remote 20).
- Next product work (edit post/video after publish) is NOT this GO.
