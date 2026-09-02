# Current Task

## Task title

WATCH_RETAINED_FIVE_OFFLINE_MANIFEST_V1

## Status

**SOURCE IMPLEMENTATION + LOCAL GATES. NO EAS. V3 owner QA remains cancelled. Do not claim BLACK_VIDEO_FIXED / BINDING_FIXED / OWNER_QA_READY.**

```
TASK_ID = WATCH_RETAINED_FIVE_OFFLINE_MANIFEST_V1
BRANCH = desktop/watch-interaction-foundation-v1-part1f
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
EAS_STARTED = NO
OWNER_FOLD6_QA = CANCELLED (V3)
WATCH_FOUNDATION_COMPLETE = NO
DEPLOYED = NO
PLAY_UPLOAD = NO
PRODUCTION_TOUCHED = NO
```

## Why

Video files alone are insufficient. Cold start offline cannot load Watch feed metadata, so retained cached videos never appear. This task persists an account-scoped offline manifest of the five most recently watched real videos and bootstraps Watch from it when the remote feed fails.

## Do not

- Claim PASS / BLACK_VIDEO_FIXED / BINDING_FIXED / OWNER_QA_READY
- Start EAS, adb install, Play upload, or Fold6 swipe QA
- Production / Play / deploy / production DB
