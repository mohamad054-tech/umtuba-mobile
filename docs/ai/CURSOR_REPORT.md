# CURSOR_REPORT — DESKTOP_ANDROID_WATCH_NEXT_VIDEO_TRANSITION_DELAY_V1

```text
TASK_ID = DESKTOP_ANDROID_WATCH_NEXT_VIDEO_TRANSITION_DELAY_V1
STATUS = COMPLETE_CODE_FIX_DEVICE_QA_NOT_RUN
SOURCE_SHA = a79f5d11b0432e825b9262c4d6dd41f28bd952dd
DEVICE = Galaxy Z Fold6
ISSUE_REPRODUCED = NO
TRANSITION_GAP_BEFORE_MS = NOT_MEASURED / OWNER_~1000
ROOT_CAUSE = ANDROID_ACTIVE_ONLY_SURFACE_REMOUNT_WITHOUT_NEXT_MEDIA_PREPARE
NEXT_METADATA_PREPARED = YES
NEXT_SIGNED_URL_PREPARED = YES
NEXT_MEDIA_PRELOADED = YES_AFTER_FIX_NEXT_ONLY_HEADLESS
PLAYER_REMOUNT_ON_TRANSITION = NO_AFTER_FIX_NEXT_PLAYER_PRESERVED
FIX_REQUIRED = YES
FIX_SCOPE = ANDROID_NEXT_ONLY_HEADLESS_PREPARE
FIX_COMMIT = a79f5d11b0432e825b9262c4d6dd41f28bd952dd
BUILD = NOT_REQUIRED
DEVICE_QA = NOT_RUN
TRANSITIONS_TESTED = 0
TRANSITION_GAP_AFTER_MS = NOT_MEASURED
BLACK_FRAME = NOT_TESTED
DUPLICATE_AUDIO = NOT_TESTED
SIMULTANEOUS_PLAYBACK = NOT_TESTED
AUTO_ADVANCE = NOT_TESTED
SWIPE_NAVIGATION = NOT_TESTED
BACK_NAVIGATION = NOT_TESTED
WATCH_REMOUNT_REGRESSION = NOT_TESTED
CRASH = NOT_TESTED
WEB_TOUCHED = NO
IOS_TOUCHED = NO
DATABASE_TOUCHED = NO
PAYMENTS_TOUCHED = NO
DEPLOYED = NO
BLOCKERS = FOLD6_ADB_EMPTY; NO_EMULATOR
NOTES = Code-proven cold ExoPlayer remount on auto-next. Signed URL window 10 already existed. Android TextureView window stays 0.
```

## Summary

Owner-observed ~1s Watch gap on Fold6 is explained in source: Android mounts only the active TextureView/ExoPlayer (`resolveWatchPlayerLoadWindow("android") = 0`). Next metadata and next signed URLs are already prepared (`WATCH_SIGNED_URL_WINDOW = 10`, high-priority next 3). Next **media** was not prepared. Auto-next claims the next index and remounts a cold `useVideoPlayer` + `VideoView`, so first-frame readiness is unknown until after the transition.

Smallest Android-only fix: while the current clip plays, prepare **only the next index** with a headless `useVideoPlayer` (muted, no TextureView). iOS ±1 load window is unchanged. Android surface window stays active-only so the dd86a3e / 17cbfef decoder-contention and remount locks stay intact. Fold6 was not on ADB; device QA is NOT_RUN.

## Exact files changed

- `app/(tabs)/watch.tsx`
- `components/WatchVideoCard.tsx`
- `src/lib/watch/playbackPolicy.ts`
- `src/lib/watch/playbackPolicy.test.ts`
- `src/lib/watch/playerLifecycle.ts`
- `src/lib/watch/playerLifecycle.test.ts`
- `src/lib/watch/playerLifecycleRegressionLock.test.ts`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

No secrets, keys, or `.env` reads. No new network surface beyond the existing signed-URL window. Next-only prepare does not download the whole feed. Android `useCaching: true` is scoped to the Watch player source object. No Play upload. No production deploy. Web/iOS/DB/payments untouched.

## Tests

Focused Watch / nav / signed-URL vitest: **87 passed / 6 files**.

- `src/lib/watch/playbackPolicy.test.ts`
- `src/lib/watch/playerLifecycleRegressionLock.test.ts` (lock 10 preserved; lock 11 added)
- `src/lib/watch/playerLifecycle.test.ts`
- `src/lib/nav/nestedProfileBack.test.ts`
- `src/lib/nav/followListAcceptance.test.ts`
- `src/lib/feed/videoStoragePath.test.ts`

## TypeScript

Changed Watch files have no new `tsc` errors. Full `npx tsc --noEmit` reports pre-existing `expo-sharing` module resolution errors (`sharePost.ts` / `sharePost.test.ts`) from the worktree `node_modules` junction to the dirty parent install. Not introduced by this change.

## Build

NOT_REQUIRED. No EAS, no APK, no Play upload (GO forbids production release).

## git diff --check

Clean.

## git status --short

Clean after docs SHA fill-in commit. Parent `umtuba-web` remains `office/profile-hero-completeness-v1` @ `380a366`. Parent `umtuba-mobile` dirty tree not reset. Not pushed.

## Open issues

- Fold6 `RFCX718LVHK` not attached (`adb devices` empty). Device QA of 10+ transitions, black-frame, audio overlap, swipe/auto/back, remount regression is **blocked**.
- After-fix gap milliseconds unknown until device QA.
- Do not treat this as a Play/production candidate.
- If Central wants Web/iOS to share this prepare model: STOP — this GO does not authorize Web/iOS.
