# Current Task

```text
TASK_ID = PC2_UM_STREAK_FOLD6_END_TO_END_AUTO_FIX_V1
STATUS = SOURCE_FIXED_EAS_PENDING
WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-um-streak-integration-v1
BRANCH = pc2/um-streak-mobile-integration-v1
DEVICE = RFCX718LVHK
ANDROID_PACKAGE = com.umtuba.app
INSTALLED_BUILD_BEFORE = 6ef7445c-fb82-46fa-a76b-c8aa4bad89e8
SUPABASE_TARGET = https://tgucwnjwoyeqoxqaxmew.supabase.co
PROJECT_REF = tgucwnjwoyeqoxqaxmew
MIGRATION_20260937_ON_TARGET = YES
MIGRATION_20260938_ON_TARGET = YES
FAILURE_STAGE = STORAGE_UPLOAD
ROOT_CAUSE = RN_SUPABASE_BLOB_FORMDATA_UPLOAD
SOURCE_FIX_REQUIRED = YES
BACKEND_FIX_REQUIRED = NO
PRODUCTION = STRICTLY_FORBIDDEN
PUSH = NO
DEPLOY = NO
PLAY = NO
```

## Product / goal

Fold6 UM Streak visual send still failed after 20260937/20260938 with Arabic `uploadFailed`. Diagnose end-to-end and apply the minimum safe fix.

## Allowed scope

- Isolated mobile UM Streak upload/send path
- Hosted read-only contract check on `tgucwnjwoyeqoxqaxmew`
- One EAS preview APK if source must change
- adb install -r on RFCX718LVHK, preserve data
- Docs in this worktree

## Forbidden scope

- Push / web deploy / Play / TestFlight
- Unrelated features or production schema
- Multiple EAS builds
- Dumping secrets or `.env` values
- Reset/uninstall unless unavoidable

## Classification

- Hosted RPC `send_um_visual_message` / `open_um_visual_message` / `get_um_streak_for_conversation` are present
- `message-media` exists, private, 20MB, allowed image/jpeg|png|webp + video/mp4|webm|quicktime
- Storage policies `Owners upload message media`, `Participants read unopened message media`, `Owners delete own message media` are present
- Remaining device failure is source-side: supabase-js wraps Blob in FormData, which React Native does not upload correctly
- Installed release APK swallows the JS Storage body, so UI always shows `تعذّر رفع الرسالة البصرية.`

## Next required gate

Commit the source fix, run one Android preview EAS, `adb install -r`, then owner visual retest.
