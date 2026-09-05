# CURSOR_REPORT — PC2_UM_STREAK_FOLD6_END_TO_END_AUTO_FIX_V1

```text
TASK_ID = PC2_UM_STREAK_FOLD6_END_TO_END_AUTO_FIX_V1
STATUS = SOURCE_FIXED_EAS_PENDING
DEVICE = RFCX718LVHK
INSTALLED_BUILD_BEFORE = 6ef7445c-fb82-46fa-a76b-c8aa4bad89e8
INSTALLED_BUILD_AFTER = PENDING
FAILURE_STAGE = STORAGE_UPLOAD
ROOT_CAUSE = RN_SUPABASE_BLOB_FORMDATA_UPLOAD
EXACT_ERROR_CODE = SWALLOWED_BY_RELEASE_APK
EXACT_ERROR_MESSAGE = تعذّر رفع الرسالة البصرية.
SOURCE_FIX_REQUIRED = YES
BACKEND_FIX_REQUIRED = NO
BACKEND_CHANGE = NONE
EAS_RUN = PENDING
PUSHED = NO
PLAY_TOUCHED = NO
UNRELATED_PRODUCTION_TOUCHED = NO
READY_FOR_OWNER_RETEST = NO
```

## Summary

Fold6 still fails on Send after 20260937/20260938 with the Storage-stage Arabic string. Live hosted checks show the UM Streak RPC, tables, private `message-media` bucket, MIME list, and upload/read/delete policies are present and match the mobile contract. The installed APK uploads via `fetch(uri).blob()` + `supabase.storage.upload(blob)`. `@supabase/storage-js` documents that React Native Blob/File/FormData uploads do not work and requires an ArrayBuffer body. That is the remaining source bug. The helper now reads bytes through Expo FileSystem (copying `content://` first) and uploads ArrayBuffer with explicit `contentType`. `image/jpg` is normalized to `image/jpeg`. Product UI stays the existing Arabic `uploadFailed` string; Storage errors are also printed to logcat for the next build.

## Exact files changed

- `src/lib/umStreak/upload.ts`
- `src/lib/umStreak/base64.ts`
- `src/lib/umStreak/base64.test.ts`
- `src/lib/umStreak/upload.test.ts`
- `src/lib/umStreak/media.ts`
- `src/lib/umStreak/media.test.ts`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

Local evidence only, do not commit: `docs/ai/pc2-fold6-e2e-autofix/`, `docs/ai/pc2-fold6-camera-upload-audit/`.

## Migrations created

None. Hosted 20260937/20260938 were already applied; no in-place policy patch required.

## Security review

- Still private `message-media` only. Path remains `{auth.uid()}/{conversationId}/{fileId}.ext`.
- No public bucket, no service-role, no new tables.
- Read-only hosted SQL via logged-in Supabase CLI. No secrets printed.
- `content://` is copied into app cache before read; no extra entitlements.

## Tests

`npx vitest run src/lib/umStreak` — 6 files, 28 passed.

## TypeScript

`npx tsc --noEmit` — pass.

## Build

Pending one Android `preview` EAS after commit.

## git diff --check

Pass on `src/lib/umStreak`.

## git status --short

Source + docs staged for the authorized fix. Evidence folders remain untracked.

## Open issues

- New APK is required; current installed build still has the Blob upload.
- Do not claim owner visual PASS until the new APK is installed and the owner retests Send.
- Release APK still will not print the old Storage body; new build logs `UM Streak message-media upload failed` if Storage rejects again.
