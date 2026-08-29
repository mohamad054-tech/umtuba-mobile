# CURSOR_REPORT — DESKTOP_ANDROID_WATCH_TRANSITION_MICRO_GAP_V2

```text
TASK_ID = DESKTOP_ANDROID_WATCH_TRANSITION_MICRO_GAP_V2
STATUS = COMPLETE_CODE_FIX_DEVICE_QA_NOT_RUN
BASE_COMMIT = a79f5d11b0432e825b9262c4d6dd41f28bd952dd
REMAINING_GAP_REPRODUCED = NO
GAP_BEFORE_MS = NOT_MEASURED
ROOT_CAUSE = SURFACE_ATTACH_AND_FIRST_FRAME_AFTER_HEADLESS_READY
NEXT_PLAYER_STATE_BEFORE_HANDOFF = WAIT_READY_TO_RENDER_ELSE_700MS
FIRST_FRAME_DELAY_MS = NOT_MEASURED
SURFACE_DELAY_MS = NOT_MEASURED
AUDIO_DELAY_MS = NOT_MEASURED
PLAYER_REUSED = NO
PLAYLIST_HANDOFF_USED = NO
FIX_APPLIED = GATE_AUTO_NEXT_ON_FIRST_FRAME_WARM_NEXT_SURFACE_NEAR_END
FIX_COMMIT = PENDING_LOCAL
DEVICE_QA = NOT_RUN
TRANSITIONS_TESTED = 0
GAP_AFTER_MS = NOT_MEASURED
BLACK_FRAME = NOT_TESTED
DUPLICATE_AUDIO = NOT_TESTED
SIMULTANEOUS_PLAYBACK = NOT_TESTED
CRASH = NOT_TESTED
WEB_TOUCHED = NO
IOS_TOUCHED = NO
DEPLOYED = NO
BLOCKERS = FOLD6_AUTHORIZED_BUT_INSTALLED_V20_NOT_V2; NO_NEW_APK; PLAY_UPLOAD_FORBIDDEN
```

## Summary

V1 left the next Android ExoPlayer **headless**. That can reach `STATE_READY` (buffered) without a TextureView, but expo-video still hides the surface until `onFirstFrameRender`. Auto-next then `claimActiveIndex` immediately, which tears down the current last frame and mounts a new TextureView — residual fraction-of-a-second blank.

V2 (Android-only):

1. Keep current last frame until handoff.
2. Near the end of the current clip (≤1800ms remaining, or already ended), attach the **next** TextureView off-screen only after that player is READY.
3. Auto-next waits for `onFirstFrameRender` (snap scroll). Max wait 700ms so the last frame cannot stall.
4. `WATCH_TX` marks: `current_end`, `next_source_activation`, `next_ready`, `surface_attached`, `first_frame`, `audio_start`. No URLs.

iOS path unchanged. Surface load window stays 0. No playlist / single-player rewrite. No second **visible** TextureView. Fold6 is authorized but still on versionCode 20 (2026-08-23); V2 is not installed. Device timings not faked.

## Exact files changed

- `app/(tabs)/watch.tsx`
- `components/WatchVideoCard.tsx`
- `src/lib/watch/playbackPolicy.ts`
- `src/lib/watch/playbackPolicy.test.ts`
- `src/lib/watch/playerLifecycleRegressionLock.test.ts`
- `src/lib/watch/watchTransitionTrace.ts`
- `src/lib/watch/watchTransitionTrace.test.ts`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

No secrets. Transition logs carry index / phase / waitedMs only. Next-only surface warm. No Play upload. Web/iOS/DB/payments untouched.

## Tests

Focused vitest **91 passed / 7 files**.

## TypeScript

Changed Watch files only. No new errors expected in those paths.

## Build

NOT_REQUIRED / not performed. Installed Fold6 binary remains versionCode 20.

## git diff --check

Clean.

## git status --short

Recorded after local commit. Parent web `380a366` preserved. Dirty mobile parent not reset. Not pushed.

## Open issues

- Device QA of V2 blocked until a non-Play local install of this SHA.
- Playlist / reused ExoPlayer not used (would be a Watch redesign).
- After-fix milliseconds unknown until Fold6 runs this build.
