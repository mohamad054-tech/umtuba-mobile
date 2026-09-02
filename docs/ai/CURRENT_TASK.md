# Current Task

## Task title

CENTRAL_WATCH_FIRST_MANUAL_SWIPE_NATIVE_PAGE_LOCK_V1

## Status

**SOURCE READY FOR OWNER REVIEW. NO EAS. NO FOLD6 BUILD.**

```
TASK_ID = CENTRAL_WATCH_FIRST_MANUAL_SWIPE_NATIVE_PAGE_LOCK_V1
BRANCH = central/watch-first-manual-swipe-native-page-lock-v1
WORKTREE = D:\umtuba-central\repos\umtuba-mobile-watch-first-manual-swipe-native-page-lock-v1
BASE_SOURCE = origin/desktop/watch-interaction-foundation-v1-part1f @ b9a40acfdfcd5e31d4fa59a8b2517f3798602786
HISTORICAL_CENTRAL_SHA = 17cbfefbc8c77d5286efdf2c9b941101db84b6c3
EAS_STARTED = NO
PUSHED = NO
BLACK_VIDEO_FIXED = NOT_CLAIMED_UNTIL_FOLD6_QA
READY_FOR_BUILD_REVIEW = YES
```

## Why

Fold6 first manual swipe plays video 2 audio (JS `activeIndex=1` is correct) while the visible Native FlatList page stays or returns to 0. Pin Native offset to page 1 on real manual `0→1` and reuse the existing `scrollToWatchIndex` lock so stale settle/viewability cannot restore page 0 during TextureView swap.

## Do not

- Start EAS / APK / Play / Production / push
- Touch cache / offline manifest / Share / ExoPlayer / surfaceType
- Change later swipes or auto-advance
- Claim BLACK_VIDEO_FIXED before Fold6 QA
