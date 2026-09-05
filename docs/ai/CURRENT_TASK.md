# Current Task

```text
TASK_ID = UMTUBA_WATCH_VIDEO_OWNER_PROFILE_NAV_REGRESSION_V1
STATUS = SOURCE_FIXED_TESTS_PASS_AWAITING_EAS
WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-um-streak-integration-v1
BRANCH = pc2/watch-owner-profile-volume-progress-v1
BASE_HEAD = d62b7ad78aead1d306a756caee14b375e71af7ff
DEVICE = RFCX718LVHK
ANDROID_PACKAGE = com.umtuba.app
OLD_BUILD = 59c6652e-3557-4b27-b057-21c36810c356
NEW_BUILD = PENDING_ONE_PREVIEW
PRODUCTION = STRICTLY_FORBIDDEN
PUSH = NO
DEPLOY = NO
PLAY = NO
UM_STREAK_TOUCHED = NO
```

## Product / goal

Owner Fold6 Watch regressions on installed build `59c6652e`, same isolated mobile worktree:

1. Tap IMAN name on IMAN video opened Mohamad's own profile.
2. Horizontal volume slider appeared; owner did not request that design.
3. Bottom progress/timeline was visually reversed/mirrored.

Restore last accepted Watch behavior. Do not invent new Watch/Profile/volume/timeline designs. Do not regress UM Streak, realtime, or upload.

## Forbidden scope

- Push / web deploy / Play / TestFlight
- Production DB / hosted migrations
- Multiple EAS builds
- UM Streak / messenger realtime / upload changes
- Claiming owner visual PASS

## Next

ONE preview EAS APK after tests PASS, then `adb install -r` on RFCX718LVHK. Stop for owner IMAN tap confirmation.
