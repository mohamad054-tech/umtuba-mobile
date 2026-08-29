# CURSOR_REPORT — DESKTOP_ANDROID_FOLD6_WATCH_VIDEO_FIT_V1

## Summary

Watch TextureView used `contentFit="cover"` → ExoPlayer `RESIZE_MODE_ZOOM` (center-crop). Fold6 cover 968×2376 crops left/right; inner 1856×2160 crops top/bottom. Source now uses `contain` / `RESIZE_MODE_FIT`. Local Gradle APK failed (disk, then Windows 260-char path). Device still on old binary. No Play upload. Watch V3 window unchanged.

## Exact files changed

- `components/WatchVideoCard.tsx`
- `src/lib/watch/watchVideoFit.ts`
- `src/lib/watch/watchVideoFit.test.ts`
- `app.config.ts` (versionCode 22 / 1.0.22)
- `.gitignore`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

Display-only resize mode. No auth/network/secrets. ADB on owner Fold6 only.

## Tests

`watchVideoFit` + `playbackPolicy` 38/38 PASS.

## TypeScript

Pre-existing `watch.tsx` handoff type error on base SHA. Not introduced here.

## Build

Local `assembleDebug` FAILED (disk, then ninja path >260). No APK.

## git diff --check

Clean on product files.

## git status --short

See commit.

## Open issues

Fold6 still running old cover/ZOOM APK. New binary not installed.
