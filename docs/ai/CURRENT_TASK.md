# CURRENT TASK — DESKTOP_ANDROID_WATCH_3_VIDEO_READY_WINDOW_CACHE_V3

## Status

`COMPLETE_CODE_FIX_DEVICE_QA_NOT_RUN`

## Task

Bounded Android Watch 3-video window: previous retained, current playing, next prepared. N+2 starts when the window slides. No Watch redesign, no feed change, no Web/iOS, no Play upload.

## Authoritative source

- Isolated worktree: `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-WATCH-NEXT-VIDEO-TRANSITION-DELAY-V1`
- Branch: `desktop/android-watch-next-video-transition-delay-v1`
- Base: `a79f5d11b0432e825b9262c4d6dd41f28bd952dd`
- Fix commit: `1a4b0f8b41ff388b99ffb136bbc39156d841e52f`

## Allowed scope

- Android Watch prepare window / retain previous / bounded Media3 cache / V2-compatible first-frame handoff
- Isolated worktree above
- Local commit
- `docs/ai/CURSOR_REPORT.md` and this file

## Forbidden scope

- Web / iOS behavior
- Parent web `380a366` and dirty mobile parent
- Single-player / playlist Watch rewrite
- Whole-feed preload, Play upload, Desktop writes, `_port_extract`

## Isolation notes

- V2 first-frame gated auto-next kept (compatible).
- Android TextureView load window stays 0.
- Fold6 authorized but installed versionCode 20 (not this SHA).
