# CURRENT TASK — DESKTOP_ANDROID_WATCH_NEXT_VIDEO_TRANSITION_DELAY_V1

## Status

`COMPLETE_CODE_FIX_DEVICE_QA_NOT_RUN`

## Task

Galaxy Z Fold6: perceptible ~1s gap when one Watch video ends and the next begins. Isolated Android reproduce / inspect / smallest fix / device QA. No production release or upload.

## Authoritative source

- Repo: `C:\Users\1\Desktop\umtuba\umtuba-mobile`
- Isolated worktree: `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-WATCH-NEXT-VIDEO-TRANSITION-DELAY-V1`
- Branch: `desktop/android-watch-next-video-transition-delay-v1`
- Base: `17cbfefbc8c77d5286efdf2c9b941101db84b6c3`
- Fix commit: `a79f5d11b0432e825b9262c4d6dd41f28bd952dd`

## Allowed scope

- Android Watch next-video transition / next-item media prepare only
- Isolated Android worktree above
- Local commit of a proven Android-only fix
- `docs/ai/CURSOR_REPORT.md` and this file in the isolated worktree

## Forbidden scope

- Web / iOS behavior changes (this GO does not authorize Web/iOS)
- Parent `umtuba-web` `office/profile-hero-completeness-v1` @ `380a366` (dirty; do not reset/clean/stash)
- Parent `umtuba-mobile` dirty checkout (do not reset/clean/stash)
- Globe / Learning / Store / DB / payments / branding
- `_port_extract`
- Windows Desktop artifact writes
- Production release, Play upload, EAS store submit, force push

## Isolation notes

- Fold6 ADB was empty (`adb devices` attached none). Device QA not run.
- Android TextureView load window stays 0 (dd86a3e / 17cbfef remount locks preserved).
- Android may prepare **next index only**, headless (no second TextureView).
- iOS `shouldLoadPlayer` / ±1 window unchanged.
