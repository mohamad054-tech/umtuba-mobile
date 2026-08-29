# CURSOR_REPORT — DESKTOP_ANDROID_WATCH_3_VIDEO_READY_WINDOW_CACHE_V3

```text
TASK_ID = DESKTOP_ANDROID_WATCH_3_VIDEO_READY_WINDOW_CACHE_V3
STATUS = COMPLETE_CODE_FIX_DEVICE_QA_NOT_RUN
BASE_COMMIT = a79f5d11b0432e825b9262c4d6dd41f28bd952dd
PLAYER_ARCHITECTURE_BEFORE = PER_CARD_EXOPLAYER_ANDROID_ACTIVE_ONLY_SURFACE
CACHE_ARCHITECTURE_BEFORE = SIGNED_URL_MEMORY_CACHE_NO_MEDIA3_SIZE_CAP_SET
THREE_VIDEO_WINDOW_IMPLEMENTED = YES
PREVIOUS_RETAINED = YES
NEXT_PRELOADED = YES
NEXT_PLUS_2_PRELOADED = YES_ON_SLIDE
SINGLE_PLAYER_REUSED = NO
MEDIA3_PLAYLIST_USED = NO
DISK_CACHE_USED = YES
CACHE_POLICY = SIZE_LRU_MEDIA3
CACHE_MAX_SIZE = 192MB
SIGNED_URL_REFETCH_ON_BACK = NO
MEDIA_BYTES_REFETCH_ON_BACK = NO
FIX_COMMIT = PENDING_LOCAL
BUILD = FAIL
DEVICE_QA = NOT_RUN
TRANSITIONS_TESTED = 0
FORWARD_GAP_BEFORE_MS = NOT_MEASURED
FORWARD_GAP_AFTER_MS = NOT_MEASURED
BACK_RETURN_BEFORE_MS = NOT_MEASURED
BACK_RETURN_AFTER_MS = NOT_MEASURED
CACHE_HIT_RATE_ADJACENT = NOT_MEASURED
BLACK_FRAME = NOT_TESTED
LOADING_SPINNER_ADJACENT = NOT_TESTED
DUPLICATE_AUDIO = NOT_TESTED
SIMULTANEOUS_PLAYBACK = NOT_TESTED
MEMORY_REGRESSION = NOT_TESTED
EXCESSIVE_NETWORK_REQUESTS = NOT_TESTED
WEB_TOUCHED = NO
IOS_TOUCHED = NO
DEPLOYED = NO
BLOCKERS = FOLD6_AUTHORIZED_BUT_INSTALLED_V20_NOT_V3; NO_NEW_APK; PLAY_UPLOAD_FORBIDDEN
NOTES = Single ExoPlayer playlist not used — would redesign Watch. V2 first-frame handoff kept. Surface window still active-only.
```

## Summary

Investigated expo-video/Media3: Watch is per-card `useVideoPlayer`. A single shared ExoPlayer + MediaItem playlist would lift playback out of cards (Watch redesign). Not done.

V3 keeps the card architecture and implements a sliding **previous / current / next** prepare window on Android:

- TextureView still current-only (Fold6 decoder lock).
- Previous player is **not** released on advance; back remounts nothing inside the window.
- Next stays prepared/buffered (`useCaching` + 8s / 12MB forward buffer).
- When current becomes N+1, N+2 enters the window immediately; N-1 evicts.
- Bounded Media3 disk cache 192MB LRU. Signed URLs stay in the existing memory cache (15min TTL); back does not re-sign if fresh.

V2 auto-next first-frame gate is kept. iOS ±1 unchanged. Fold6 is on USB but still versionCode 20 — V3 not installed. No Play upload.

## Exact files changed

- `app/(tabs)/watch.tsx`
- `components/WatchVideoCard.tsx`
- `src/lib/watch/playbackPolicy.ts`
- `src/lib/watch/playbackPolicy.test.ts`
- `src/lib/watch/playerLifecycle.ts`
- `src/lib/watch/playerLifecycle.test.ts`
- `src/lib/watch/playerLifecycleRegressionLock.test.ts`
- `src/lib/watch/androidWatchMediaCache.ts`
- `src/lib/watch/androidWatchMediaCache.test.ts`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

No secrets. Cache size is local Media3 LRU, not a user-visible download. Transition logs have no URLs. Web/iOS/DB/payments untouched.

## Tests

Focused vitest **92 passed / 8 files**.

## TypeScript

Changed Watch files only.

## Build

FAIL — no APK/EAS. Installed Fold6 binary remains versionCode 20.

## git diff --check

Clean.

## git status --short

After local commit. Parent web `380a366` preserved. Dirty mobile parent not reset. Not pushed.

## Open issues

- Device QA blocked until a non-Play install of this SHA.
- Single-player playlist still a Central redesign decision.
