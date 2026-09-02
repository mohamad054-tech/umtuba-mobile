# Current Task

## Task title

DESKTOP_FOLD6_WATCH_PROVEN_ROOT_CAUSE_FIX_V3

## Status

**V3 SOURCE COMMITTED AND PUSHED. EAS c6eb9f2c INSTALLED ON FOLD6. OWNER QA REQUIRED. DO NOT CLAIM PASS.**

Do not claim BLACK_VIDEO_FIXED or BINDING_FIXED. No owner swipe QA was run.

```
TASK_ID = DESKTOP_FOLD6_WATCH_PROVEN_ROOT_CAUSE_FIX_V3
FIX_SHA = 2a977686d90021622e1e63382c2a8a28f47f7b84
BRANCH = desktop/watch-interaction-foundation-v1-part1f
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
EAS_BUILD_ID = c6eb9f2c-5d66-43ab-9eb3-566c5e9d736d
EAS_URL = https://expo.dev/accounts/umtuba/projects/umtuba-mobile/builds/c6eb9f2c-5d66-43ab-9eb3-566c5e9d736d
APK_URL = https://expo.dev/artifacts/eas/HBHUIUubleYWjp4tdWoYVlrrnBgoECOizaF2RaOWgKA.apk
EAS_STATUS = FINISHED (gitCommitHash 2a977686)
ADB_INSTALL = SUCCESS 2026-09-02 18:14:46 +3 (adb install -r)
APP_DATA_PRESERVED = YES (firstInstallTime 2026-08-18 09:20:18 unchanged)
APP_LAUNCHED = YES
OWNER_FOLD6_QA = REQUIRED
WATCH_FOUNDATION_COMPLETE = NO
NEW_BUILD_COUNT = 1
DEPLOYED = NO
PLAY_UPLOAD = NO
PRODUCTION_TOUCHED = NO
```

## Proven root causes closed in source (owner QA still required)

A. `readyToPlay` now uses `resolveGatedWatchPlaybackIntent` (same gate as the layout effect). No surface / stale post/epoch → no audible play. Android may start muted; unmute only after first frame.

B. One frozen FlatList container height per layout session. TextureView cannot mutate itemHeight or snap points. Height-jitter `scrollToOffset`/`claimActiveIndex` removed. Fold/unfold is a new session and keeps the current post id.

## Tests

`tsc --noEmit` PASS. Watch suite 154 PASS, including the ten required V3 assertions.

## Owner QA on Fold6 (this APK)

1. Cold/open Watch. Video 1 should display and play.
2. Swipe 1→2: item 2 picture + item 2 audio. No black TextureView.
3. Swipe 2→3: item 3 picture + item 3 audio. Must not return to video 1.
4. Share → Cancel/Back stays on the same video.
5. Do not run 1B/1C/1D/2x/sound QA.

## Do not

- Claim PASS / BLACK_VIDEO_FIXED / BINDING_FIXED without owner Fold6 evidence
- Production / Play / deploy / production DB
- Start a second EAS
- Uninstall UMTUBA (adb install -r only)
