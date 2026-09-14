# Current Task

```text
TASK_ID = UMTUBA_REMOVE_SIGNUP_INVITE_CODE_V1
STATUS = SOURCE_COMMITTED_LOCAL_ONLY
WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-remove-signup-invite-v1
BRANCH = pc2/remove-signup-invite-code-v1
COMMIT = c714dd2bb5c2e86532ffe654e2990025ce345a60
BASE_HEAD = f48b6a9a419d7a8f221436755f5ffa129ac6e894
DEVICE = RFCX718LVHK
DEVICE_CONNECTED = NO
ANDROID_PACKAGE = com.umtuba.app
OLD_BUILD = 59c6652e-3557-4b27-b057-21c36810c356
NEW_BUILD = NONE
PRODUCTION = STRICTLY_FORBIDDEN
PUSH = NO
EAS = NO
ADB_INSTALL = SKIPPED_DEVICE_NOT_CONNECTED
PLAY = NO
UM_STREAK_TOUCHED = NO
READY_FOR_OWNER = NO
```

## Product / goal

Remove "رقم الدعوة" from new-account signup. Source-only commit is done. Installed Fold6 APK is unchanged because the device is not plugged in.

## Next

When Fold6 is plugged in: one EAS preview Android + `adb install -r` (preserve data). Do not start EAS before that.
