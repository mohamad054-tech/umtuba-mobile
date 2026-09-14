# CURSOR_REPORT — PC2-A1 EAS Preview Config Clean Commit

```text
PC2-A1 REPORT
SOURCE_DEVICE = PC2
TASK_ID = PC2_A1_EAS_PREVIEW_CONFIG_CLEAN_COMMIT_V1
EAS_CONFIG_SHA = 77e9e287e117fc9a19f9a5df1596f69b0b8bf07f
EAS_PROFILE_PREVIEW_READY = YES
IOS_BUNDLE_ID = com.umtuba.app
IOS_BUILD_NUMBER = 1
SECRET_VALUES_COMMITTED = NO
STATIC_VALIDATION = PASS (vitest appStoreConfig 4/4; tsc --noEmit; git diff --check)
CENTRAL_FETCH_READY = YES
PUSH_REQUIRED = YES
BRANCH = pc2/eas-preview-config-v1
FILES_CHANGED = eas.json; src/lib/ios/appStoreConfig.test.ts
PC2_A1_NEXT = STOP
```

## Summary

Created isolated branch `pc2/eas-preview-config-v1` from `origin/master` (`eb0267a`, which includes accepted iOS prep `64a2fdd`). Committed smallest correct EAS preview config: internal device IPA (`distribution: internal`, `ios.simulator: false`), no preview `autoIncrement`, and public Team ID on `submit.production.ios.appleTeamId`. Updated `appStoreConfig.test.ts` to lock those contracts. Did not push (task-delivery push not clearly authorized for mobile).

## Exact files changed

- `eas.json`
- `src/lib/ios/appStoreConfig.test.ts`

## Migrations created

None.

## Security review

Team ID `M6HDH86Z55` is already public via AASA / `app.config.ts`. No secrets, credentials, or `.env` values committed.

## Tests

`npx vitest run src/lib/ios/appStoreConfig.test.ts` — 4 passed.

## TypeScript

`npx tsc --noEmit` — pass.

## Build

Not required (config/test only; no app UI entry change).

## git diff --check

Pass on committed files.

## git status --short

Clean on `pc2/eas-preview-config-v1` after commit (ahead of `origin/master` by 1).

## Open issues

- `PUSH_REQUIRED = YES` — operator/central must push `pc2/eas-preview-config-v1` (`77e9e28`) when delivery push is authorized.
- Expo/EAS login and actual `eas build --profile preview` remain operator steps (out of this task).
