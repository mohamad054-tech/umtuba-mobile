# Current Task

```text
TASK_ID = UMTUBA_REMOVE_SIGNUP_INVITE_CODE_V1
STATUS = SOURCE_COMMIT_THEN_EAS_PREVIEW
WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-remove-signup-invite-v1
BRANCH = pc2/remove-signup-invite-code-v1
BASE_HEAD = f48b6a9a419d7a8f221436755f5ffa129ac6e894
BASE_BRANCH = pc2/watch-owner-profile-volume-progress-v1
OWNER_ACCEPTED_NO_FIELD_SHA = 15d9aec5a219ba0200e5d6e562d4f92242c69f4b
DEVICE = RFCX718LVHK
ANDROID_PACKAGE = com.umtuba.app
OLD_BUILD = 59c6652e-3557-4b27-b057-21c36810c356
NEW_BUILD = PENDING_EAS
PRODUCTION = STRICTLY_FORBIDDEN
PUSH = NO
DEPLOY = NO
EAS = ONE_PREVIEW_ANDROID_AUTHORIZED
PLAY = NO
UM_STREAK_TOUCHED = NO
```

## Product / goal

Get "رقم الدعوة" / invite / referral field OFF the Fold6 app the owner is using. Isolated source-only work is not enough — commit, one EAS preview APK, `adb install -r`, then prove the field is gone on device.

## Allowed scope

- Signup-only source commit on this isolated branch
- One EAS preview Android APK
- `adb -s RFCX718LVHK install -r` (preserve data, do not uninstall)
- Device UI dump / screenshot of signup
- Targeted tests + `tsc --noEmit`

## Forbidden scope

- Force push / Play / production DB / alpha merge
- Reset app data / uninstall
- UM Streak camera edits
- Multiple EAS builds unless the first is blocked
