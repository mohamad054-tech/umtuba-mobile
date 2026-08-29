# CURRENT TASK — DESKTOP_ANDROID_WATCH_TRANSITION_MICRO_GAP_V2

## Status

`COMPLETE_CODE_FIX_DEVICE_QA_NOT_RUN`

## Task

Residual fraction-of-a-second Watch gap on Fold6 after V1 headless next-prepare (`a79f5d1`). Measure remaining path. Handoff only when next is ready to render. Next-item-only. No Watch redesign, no feed change, no Web/iOS, no Play upload.

## Authoritative source

- Isolated worktree: `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-WATCH-NEXT-VIDEO-TRANSITION-DELAY-V1`
- Branch: `desktop/android-watch-next-video-transition-delay-v1`
- Base: `a79f5d11b0432e825b9262c4d6dd41f28bd952dd`

## Allowed scope

- Android Watch auto-next handoff / next-only surface warm / transition marks
- Isolated worktree above
- Local commit of a proven Android-only fix
- `docs/ai/CURSOR_REPORT.md` and this file

## Forbidden scope

- Web / iOS behavior
- Parent web `office/profile-hero-completeness-v1` @ `380a366`
- Dirty parent `umtuba-mobile`
- Feed rewrite, Watch redesign, playlist/single-player rewrite
- Second **visible** TextureView / preload beyond immediate next
- Play upload, production deploy, Desktop writes, `_port_extract`

## Isolation notes

- Fold6 `RFCX718LVHK` authorized this session, but installed app is versionCode **20** (2026-08-23), not V1/V2.
- V2 not installed. Device QA of this fix is NOT_RUN.
- Android load window stays 0. iOS ±1 unchanged.
