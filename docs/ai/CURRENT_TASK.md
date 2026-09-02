# Current Task

## Task title

DESKTOP_FOLD6_WATCH_VIDEO_CELL_BINDING_FAILURE_V2

## Status

**SOURCE FIX COMMITTED AND PUSHED. EAS 5bec2a1f INSTALLED ON FOLD6. OWNER QA REQUIRED. DO NOT CLAIM PASS.**

Owner Fold6 QA on `0b7e63c` / `91e8f585` = **FAIL** (video 2 black; swipe 2→3 returned to video 1; video 1 repeated three times). Previous TextureView/Modal and bind+5-cache candidates both failed. Do not claim BLACK_VIDEO_FIXED or BINDING_FIXED.

```
TASK_ID = DESKTOP_FOLD6_WATCH_VIDEO_CELL_BINDING_FAILURE_V2
PREVIOUS_0B7E63C_GATE = FAIL
PREVIOUS_3C2B747E_GATE = FAIL
PART1F_DEVICE_GATE = FAIL
SOURCE_SHA = 83df875e925312ea2bb7b17b4e47a48b54f42ec5
BASE_SHA = 0b7e63c7bfe4689b249ad374e9189d35d8cec412
BRANCH = desktop/watch-interaction-foundation-v1-part1f
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
EAS_BUILD_ID = 5bec2a1f-93d8-4a93-a70e-ae096aa85414
EAS_URL = https://expo.dev/accounts/umtuba/projects/umtuba-mobile/builds/5bec2a1f-93d8-4a93-a70e-ae096aa85414
APK_URL = https://expo.dev/artifacts/eas/gjP_kv6Dzn7ihhftGV-_1yIQEnVWfQcJpueEYaloqpI.apk
EAS_STATUS = FINISHED (gitCommitHash 83df875e)
ADB_INSTALL = SUCCESS 2026-09-02 16:50 +3 (adb install -r; firstInstallTime unchanged 2026-08-18)
APP_DATA_PRESERVED = YES
APP_LAUNCHED = YES
OWNER_FOLD6_QA = REQUIRED
WATCH_FOUNDATION_COMPLETE = NO
DEPLOYED = NO
PLAY_UPLOAD = NO
PRODUCTION_TOUCHED = NO
```

## Root cause (code + owner FAIL on 0b7e63c)

Not Modal. Not “attach next TextureView when READY.” That 0b7e63c change made Fold6 worse.

1. Off-screen next TextureView mounted while still on video 1, changing Fold6 cell/list height.
2. `itemHeight` effect then `scrollToOffset(activeIndex * height)`. Viewability still reported index 0, so the list snapped back to video 1. That is the “video 1 repeats three times” / “2→3 returns to video 1” path.
3. `onViewableItemsChanged` took the first 80%-visible item (one page late / stuck on 0), not the settled scroll page.
4. Playback started as soon as ExoPlayer was ready, before the active TextureView attached → audio on a black/stale surface.
5. Recycled cells updated `epochSrc` in `useEffect` (one frame stale). Initial feed was not deduped by post/media id (duplicate FlatList keys).

## Source fix on 83df875e

- Android attaches TextureView only for the active load-window cell. Prepared neighbors stay silent without a surface.
- Play only after the active surface is attached and player media id matches the visible post.
- Active index comes from settled scroll offset. Height relayout infers the current page from the live offset, never blindly index 0.
- Cell source is replaced synchronously when post/media id or src changes; player remounts on that identity.
- `mergeWatchVideos` / initial load strip duplicate post IDs without reordering.
- Existing `androidWatchMediaCache` rolling target of 5 is unchanged (no second cache).
- Part1F in-place share and closed Watch gestures are unchanged.

## Tests already run

Focused Watch binding + policy + lifecycle + cache tests PASS (79). `tsc --noEmit` PASS.

Coverage added:
1. 1→2 binding (picture+audio+cell+player+media id aligned)
2. 2→3 binding (not video 1)
3. duplicate post IDs stripped without reordering
4. recycled cell source replacement (stale player/src cannot survive key/post change)

## Owner QA on Fold6 (this APK)

1. Cold/open Watch. Video 1 should display and play.
2. Swipe 1→2: item 2 picture + item 2 audio. No black TextureView. No video 1 picture/audio.
3. Swipe 2→3: item 3 picture + item 3 audio. Must not return to video 1. Video 1 must not repeat.
4. Share → Cancel/Back still dismisses in place on the same video.
5. Do not run 1B/1C/1D/2x/sound QA.

## Do not

- Claim PASS / BLACK_VIDEO_FIXED / BINDING_FIXED without owner Fold6 evidence
- Production / Play / deploy / production DB
- Fake feed data / blind delays / reset-to-item-1 workaround
- Second independent cache system
- Another EAS if `5bec2a1f` is already installed
