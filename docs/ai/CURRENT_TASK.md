# Current Task

## Task title

DESKTOP_FOLD6_WATCH_PROVEN_ROOT_CAUSE_FIX_V3

## Status

**V3 SOURCE FIX COMMITTED. EAS / INSTALL FOLLOW IN THIS TURN. OWNER QA REQUIRED. DO NOT CLAIM PASS.**

Do not claim BLACK_VIDEO_FIXED or BINDING_FIXED. Do not owner-swipe QA in this turn.

```
TASK_ID = DESKTOP_FOLD6_WATCH_PROVEN_ROOT_CAUSE_FIX_V3
PREVIOUS_0B7E63C_GATE = FAIL
PREVIOUS_V2_83DF875_GATE = INSTALLED_OWNER_QA_REQUIRED
BRANCH = desktop/watch-interaction-foundation-v1-part1f
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
WATCH_FOUNDATION_COMPLETE = NO
OWNER_FOLD6_QA = REQUIRED
DEPLOYED = NO
PLAY_UPLOAD = NO
PRODUCTION_TOUCHED = NO
```

## Proven root causes (accepted diagnostic)

A. `readyToPlay` called play()+unmute before the active TextureView existed. `shouldStartPlaybackAfterAsset` was only used from the layout effect.

B. Native paging used a height TextureView still changed (2121→1720, 968×968). The `itemHeight` effect `scrollToOffset`/`claimActiveIndex` desynced JS `activeIndex` from the visual page.

## V3 source fix

- Every playback-start path uses `resolveGatedWatchPlaybackIntent` (same gate). No surface / stale post/epoch → no play.
- Android may start muted; unmute only after first-frame confirmation.
- One frozen FlatList container height per layout session. TextureView cannot mutate itemHeight or snap points.
- Height-jitter `scrollToOffset`/`claimActiveIndex` removed. Fold/unfold is a new session and keeps the current post id.
- Native settle is reconciled from the frozen page. Rolling cache target stays 5. Share overlay unchanged.

## Tests

`tsc --noEmit` PASS. Focused V3 tests + existing Watch suite PASS (154).

## Owner QA on Fold6 (after this APK is installed)

1. Cold/open Watch. Video 1 should display and play.
2. Swipe 1→2: item 2 picture + item 2 audio. No black TextureView.
3. Swipe 2→3: item 3 picture + item 3 audio. Must not return to video 1.
4. Share → Cancel/Back stays on the same video.
5. Do not run 1B/1C/1D/2x/sound QA.

## Do not

- Claim PASS / BLACK_VIDEO_FIXED / BINDING_FIXED without owner Fold6 evidence
- Production / Play / deploy / production DB
- Start a second EAS if the first fails
- Uninstall UMTUBA (adb install -r only)
