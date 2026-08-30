# DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1C_P1_INTERACTIONS

Isolated P1 implementation. No deploy. No Play/App Store upload. No migrations.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1C_P1_INTERACTIONS
STATUS = IMPLEMENTATION_COMPLETE
BASE_SHA = dd32033172684048f2c108a9f4e2eded4fd32292
BRANCH = desktop/watch-interaction-foundation-v1-part1c
LONG_PRESS_IMPLEMENTED = YES
QUICK_ACTIONS_IMPLEMENTED = YES
HAPTICS_IMPLEMENTED = YES
HAPTICS_BLOCKER = NONE
PLAYBACK_SPEED_IMPLEMENTED = YES
SCRUB_THRESHOLD = 8s (WATCH_SCRUB_MIN_DURATION_SEC)
OPTIMISTIC_LIKE = YES
OPTIMISTIC_SAVE = YES
FOLLOW_FROM_WATCH = YES
NOT_INTERESTED = DEVICE_LOCAL_PERSISTENT
DOUBLE_TAP_REGRESSION = NO (tests)
SINGLE_TAP_REGRESSION = NO (tests)
VERTICAL_PAGING_REGRESSION = NO (tests)
PLAYBACK_REGRESSION = NO (tests)
PRELOAD_REGRESSION = NO (tests)
FOCUSED_TESTS = PASS (146)
TYPECHECK = PASS
ANDROID_BUILD = PENDING
FOLD6_DEVICE_QA = PENDING
IOS_DEVICE_QA = NOT_RUN
DEPLOYED = NO
PLAY_UPLOAD = NO
APP_STORE_UPLOAD = NO
MIGRATIONS_CREATED = NO
READY_FOR_PART1D_P2 = NO
```

## What shipped

### Long-press quick actions

- Safe video area only (`shouldOpenWatchQuickActions("video")`).
- `WATCH_LONG_PRESS_MS = 450` (above the 240ms double-tap window).
- Long-press cancels `WatchTapClassifier` so it cannot fire play/pause or like.
- Original UMTUBA sheet (`WatchQuickActions`): dark surface, cyan selected chips, one-thumb rows. Not a TikTok clone.
- Actions: Save, Not Interested, Playback Speed, Captions, Share, Report (when allowed), Follow (when not self).
- Rail / comments / share / save / volume / scrub / retry / header stay later siblings and keep hit-testing.

### Haptics

- Official Expo 57 package `expo-haptics` ~57.0.2.
- `watchLightHaptic()` dynamic-imports and no-ops if the native module is missing.
- Used for successful double-tap Like, Save, Follow, and non-duplicated quick-action picks (speed / captions / not-interested / share / report).

### Playback speed

- 0.5x / 1.0x / 1.5x / 2.0x. Default 1.0x.
- Applied only on the active player via `PlayerLike.playbackRate`. Inactive panes forced to 1.0.
- Resets to 1.0x when `activeVideoId` changes. No per-video speed store.

### Scrub eligibility

- Threshold: **8 seconds** (`WATCH_SCRUB_MIN_DURATION_SEC`).
- `canSeekWithDuration` and RTL progress math unchanged.
- Clips under 8s keep a thin non-interactive progress line.

### Optimistic Like / Save

- UI patches immediately from `previewEnsureLike` / `previewToggleLike` / `previewToggleSave`.
- Rollback to the captured snapshot on RPC failure.
- Per-postId in-flight on `ensurePostLike`, `togglePostLike`, and `togglePostSave`.
- Double-tap still uses `ensurePostLike` and never unlikes. Rail heart still uses `togglePostLike`.

### Follow from Watch

- Compact Follow chip + sheet row. Follow only. Already-following shows stable Following (disabled).
- `ensureProfileFollow` reads `get_profile_follow_snapshot` first; only then calls `toggle_profile_follow`.
- If toggle unexpectedly returns not-following, a restore toggle is attempted and the client reports failure.
- Optimistic local map with rollback. Hydrate does not clobber a local `true` with a stale `false`.
- Profile remains the unfollow surface.

### Not Interested

- **DEVICE_LOCAL_PERSISTENT** via existing `hidePostLocally` / `umtuba.ugc.hiddenPosts`.
- No backend taxonomy. No migrations. Survives app restart on this device. Not account-synced.

### Captions

- `WATCH_CAPTIONS_MODE = "post-caption-overlay"`.
- No subtitle track exists (`hasWatchCaptionTrack() === false`).
- Toggle enlarges the on-screen post caption only.

## Preserved

Part 1B classifier, already-liked no-op, single-tap play/pause, vertical paging, index-0 refresh only, CommentsSheet, Share, Profile return, Android active-only TextureView, Android 3-window prepare, iOS ±1, retry overlay, volume, scrub math, account/session, localization. FIT design not reopened.

## Tests

```
npx vitest run src/lib/watch/watchGestures.test.ts src/lib/watch/watchQuickActions.test.ts src/lib/social/interactions.test.ts src/lib/social/follows.test.ts src/lib/watch/playerLifecycle.test.ts src/lib/watch/playerLifecycleRegressionLock.test.ts src/lib/watch/activePlayerOwnership.test.ts src/lib/watch/playerSession.test.ts src/lib/watch/playbackPolicy.test.ts src/lib/i18n/i18n.test.ts
npx tsc --noEmit
```

146 PASS / tsc PASS.

## Device QA checklist (do not claim PASS until observed)

### Android / Galaxy Z Fold6

- [ ] Long press opens quick actions
- [ ] Quick actions: Save, Not Interested, Speed, Captions, Report, Share, Follow
- [ ] Speed 0.5 / 1.0 / 1.5 / 2.0 on active video only
- [ ] Speed resets after swipe to another post
- [ ] Double tap still likes; already-liked stays liked
- [ ] Single tap play/pause
- [ ] Swipe up/down pages
- [ ] Scrub on long videos; no extra affordance on very short clips
- [ ] Volume
- [ ] Comments / Share / Profile return
- [ ] Background / foreground
- [ ] No duplicate audio

### iOS / iPhone

Not run in this GO.
