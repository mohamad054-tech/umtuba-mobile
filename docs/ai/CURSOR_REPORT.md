# CURSOR_REPORT — PC2_UM_STREAK_FOLD6_END_TO_END_AUTO_FIX_V1

```text
TASK_ID = PC2_UM_STREAK_FOLD6_END_TO_END_AUTO_FIX_V1
STATUS = SOURCE_FIXED_DEVICE_RETESTED
DEVICE = RFCX718LVHK
INSTALLED_BUILD_BEFORE = 6ef7445c-fb82-46fa-a76b-c8aa4bad89e8
INSTALLED_BUILD_AFTER = 52e38325-045a-4d8c-9fa5-8c0b28b899a0
FAILURE_STAGE = STORAGE_UPLOAD
ROOT_CAUSE = RN_SUPABASE_BLOB_FORMDATA_UPLOAD
EXACT_ERROR_CODE = SWALLOWED_BY_RELEASE_APK
EXACT_ERROR_MESSAGE = تعذّر رفع الرسالة البصرية.
SOURCE_FIX_REQUIRED = YES
BACKEND_FIX_REQUIRED = NO
FILES_CHANGED = src/lib/umStreak/upload.ts, src/lib/umStreak/base64.ts, src/lib/umStreak/base64.test.ts, src/lib/umStreak/upload.test.ts, src/lib/umStreak/media.ts, src/lib/umStreak/media.test.ts, docs/ai/CURRENT_TASK.md, docs/ai/CURSOR_REPORT.md
BACKEND_CHANGE = NONE
TESTS = PASS (28)
TYPECHECK = PASS
EAS_RUN = YES
EAS_BUILD_ID = 52e38325-045a-4d8c-9fa5-8c0b28b899a0
ADB_INSTALL = SUCCESS_REPLACE
STORAGE_UPLOAD = PASS
MESSAGE_RPC = PASS
MESSAGE_ROW_CREATED = YES
ATTACHMENT_CREATED = YES
CAMERA = PASS
CAPTURE_PREVIEW = PASS
SEND_AFTER_FIX = PASS
PUSHED = NO
PLAY_TOUCHED = NO
UNRELATED_PRODUCTION_TOUCHED = NO
READY_FOR_OWNER_RETEST = YES
BLOCKERS = Thread screen hit pre-existing realtime postgres_changes error after successful send
NEXT_ACTION = Owner visual retest of Fold6 Send. Optional later fix for messenger realtime subscribe error boundary.
```

## Summary

The remaining Fold6 failure was not backend. Hosted `tgucwnjwoyeqoxqaxmew` already has `send_um_visual_message`, private `message-media`, the 20MB MIME allow-list, and the 20260937 upload/read/delete policies. The installed APK uploaded with `fetch(uri).blob()` + supabase-js, which wraps Blob in FormData. storage-js documents that React Native Blob/FormData uploads do not work. The helper now reads bytes through Expo FileSystem (copying `content://` first), decodes to ArrayBuffer, and uploads with explicit `contentType`. `image/jpg` is normalized to `image/jpeg`.

One EAS preview `52e38325` from commit `7cf5878` was installed with `adb install -r`. A controlled cover-screen photo send at 15:15 local created:

- message `66887dc7-a10c-4ced-b44d-c6f1a25b7644` (`image`, `view_once`)
- attachment `message-media` / `{uid}/{conversationId}/v-1788610504790-4rxkmjjw.jpg` / `image/jpeg` / 2926904 bytes
- storage object present
- `um_streak_events` row for `2026-09-05`

After navigation, the thread error-bounded on a pre-existing Realtime `postgres_changes after subscribe()` error. That is not the upload/RPC failure. Do not claim owner visual PASS.

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

None. 20260937/20260938 were already applied. No policy patch.

## Security review

- Still private `message-media` only. Path remains `{auth.uid()}/{conversationId}/{fileId}.ext`.
- No public bucket, no service-role, no new tables, no production schema invention.
- Read-only hosted SQL via logged-in Supabase CLI. No secrets printed.
- One controlled owner-session send on the connected device.

## Tests

`npx vitest run src/lib/umStreak` — 6 files, 28 passed.

## TypeScript

`npx tsc --noEmit` — pass.

## Build

One Android preview EAS: `52e38325-045a-4d8c-9fa5-8c0b28b899a0` from `7cf5878`. Finished.

## git diff --check

Pass on `src/lib/umStreak`.

## git status --short

Fix committed. Evidence folders remain untracked.

## Open issues

- Owner should visually confirm preview, send, and open on Fold6. Automation does not claim human-eye PASS.
- After successful send, thread UI hit `cannot add postgres_changes callbacks for realtime:messenger-inbox:... after subscribe()`. Separate messenger realtime bug; not this upload fix.
