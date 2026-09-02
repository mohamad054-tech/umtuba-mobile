# Current Task

## Task title

WATCH_FIRST_MANUAL_SWIPE_NATIVE_PAGE_LOCK_V1

## Status

**SOURCE IMPLEMENTATION + LOCAL GATES. NO EAS. Do not claim BLACK_VIDEO_FIXED.**

```
TASK_ID = WATCH_FIRST_MANUAL_SWIPE_NATIVE_PAGE_LOCK_V1
BRANCH = desktop/watch-interaction-foundation-v1-part1f
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
EAS_STARTED = NO
PUSHED = NO
WATCH_FOUNDATION_COMPLETE = NO
DEPLOYED = NO
PLAY_UPLOAD = NO
PRODUCTION_TOUCHED = NO
BLACK_VIDEO_FIXED = NOT_CLAIMED_UNTIL_FOLD6_QA
```

## Why

Manual first swipe 0→1 claims the video-2 player (audio plays) while the native FlatList page stays on 0 (black, no VideoView). Auto-advance already claims then pins `scrollToOffset` + 750ms lock. This task copies that pin+lock onto the genuine manual 0→1 claim only.

## Do not

- Claim PASS / BLACK_VIDEO_FIXED / BINDING_FIXED / OWNER_QA_READY
- Start EAS, adb install, Play upload, or Fold6 swipe QA
- Production / Play / deploy / production DB
- Change later manual swipes, auto-advance, WatchVideoCard, cache, offline, Share, surface, or playback windows
