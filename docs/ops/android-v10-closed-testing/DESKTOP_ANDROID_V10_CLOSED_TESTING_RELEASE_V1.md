# DESKTOP_ANDROID_V10_CLOSED_TESTING_RELEASE_V1

**DATE:** 2026-08-17  
**DEVICE:** DESKTOP  
**WORKTREE:** `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC`  
**BRANCH:** `office/android-v10-clean-candidate-v1`  
**REMOTE:** `https://github.com/mohamad054-tech/umtuba-mobile.git`  
**PRODUCTION_SUBMISSION:** NO  
**PRODUCTION_AUTHORIZATION:** HOLD  

```
TASK_ID = DESKTOP_ANDROID_V10_CLOSED_TESTING_RELEASE_V1
STATUS = P0_P1_PASS_P2_BLOCKED
SOURCE_SHA = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
TREE_CLEAN = YES
SOURCE_PUSHED = YES
REMOTE_SHA = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
SOURCE_MATCH = YES
AAB_BUILD_ID = b0425996-1697-427d-8c47-be8a437f042b
AAB_SOURCE_SHA = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
AAB_VERSION_NAME = 1.0.0
AAB_VERSION_CODE = 10
AAB_PATH = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC\docs\ops\android-v10-closed-testing\aab\umtuba-android-production-b0425996.aab
AAB_SHA256 = 4BB83DD7F92B2F0BC54A7968114BE4BD3720BAA0C0C7C9B90588802BF5104300
AAB_SIZE = 90691892
CLOSED_TESTING_UPLOAD = NO
CLOSED_TESTING_TRACK = alpha (Play Closed Testing; not used this session)
PLAY_PROCESSING_STATUS = NOT_UPLOADED
VERSION10_VISIBLE_TO_TESTERS = NO
CURRENT_TESTER_PROGRAM_PRESERVED = YES
DEVICE_QA_RESULT = PASS
UNSUPPORTED_LOCALE_FALLBACK = BLOCKED_DEVICE
ANDROID_V10_CLOSED_TESTING_CANDIDATE = YES
PRODUCTION_SUBMISSION = NO
PRODUCTION_AUTHORIZATION = HOLD
```

## P0 — source deposit

| Check | Result |
|---|---|
| `git rev-parse HEAD` | `9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d` |
| Source tree | Clean. Untracked/modified docs + `.easignore` only. `eas.json` / `app.config.ts` match HEAD. |
| `74188be` merged | **NO** (not an ancestor of HEAD) |
| Transport | `git fetch --prune origin` then `git push origin 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d:refs/heads/office/android-v10-clean-candidate-v1` |
| Remote URL | `https://github.com/mohamad054-tech/umtuba-mobile.git` |
| Remote branch | `office/android-v10-clean-candidate-v1` (new) |
| `git ls-remote` | `9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d` |
| `origin/central/mobile-reconcile-ios-android-v1` | Left at `74188be`. Not merged. Not FF’d. |

## P1 — Play AAB

No prior production AAB existed for this SHA (only preview APK `8a6c491f`, versionCode 10). New STORE AAB built from the exact authorized SHA.

Remote EAS `Android versionCode` was already **10**. Committed `eas.json` has `production.autoIncrement: true` and `cli.appVersionSource: remote`. A default production build would have emitted **11**.

Override used for this build only (not committed): local `autoIncrement: false` while queuing, then `eas.json` restored to HEAD (`autoIncrement: true`). Remote versionCode remained **10**.

| Field | Value |
|---|---|
| Command | `npx eas-cli build --platform android --profile production --non-interactive --no-wait` |
| EAS_BUILD_ID | `b0425996-1697-427d-8c47-be8a437f042b` |
| Status | FINISHED |
| Profile / distribution | production / STORE |
| EAS `gitCommitHash` | `9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d` |
| EAS `appVersion` | `1.0.0` |
| EAS `appBuildVersion` | **10** (not 11) |
| Package | `com.umtuba.app` |
| Keystore | existing remote `p6De1DDtE_` (default). Not rotated. |
| Expo build URL | `https://expo.dev/accounts/umtuba/projects/umtuba-mobile/builds/b0425996-1697-427d-8c47-be8a437f042b` |
| Local AAB | `docs/ops/android-v10-closed-testing/aab/umtuba-android-production-b0425996.aab` |
| Bytes | `90691892` |
| SHA256 | `4BB83DD7F92B2F0BC54A7968114BE4BD3720BAA0C0C7C9B90588802BF5104300` |
| Zip | App Bundle (`BundleConfig.pb` + `base/manifest/AndroidManifest.xml`) |

### How versionCode 10 was proven

1. EAS build metadata at queue and FINISHED: `appBuildVersion = 10`, `appVersion = 1.0.0`, `gitCommitHash = 9e04a97…`.
2. `eas build:version:get --platform android` before and after queue: remote Android versionCode **10** (no increment).
3. bundletool 1.18.1 dump (portable Temurin 17):

```
package = com.umtuba.app
versionName = 1.0.0
versionCode = 10
minSdkVersion = 24
targetSdkVersion = 36
```

Evidence: `aab-package.txt`, `aab-versionName.txt`, `aab-versionCode.txt`, `aab-manifest.xml`, `eas-view-b0425996-safe.json`.

## P2 — Closed Testing upload

**NOT PERFORMED.** Tester list not touched. Production not submitted.

Approved path attempted:

```
npx eas-cli submit --platform android --profile closed-testing --id b0425996-1697-427d-8c47-be8a437f042b --non-interactive --wait
```

with a local-only submit profile (restored after failure; not committed):

```json
"closed-testing": {
  "android": {
    "track": "alpha",
    "releaseStatus": "completed",
    "changesNotSentForReview": true
  }
}
```

Exact Play track name intended: **`alpha`** (existing Closed Testing / Alpha track). Not `production`. Not `internal`. Not `beta`.

### Blocker

`eas submit --non-interactive` → `Google Service Account Keys cannot be set up in --non-interactive mode.`

EAS account `umtuba` has **0** Google Service Account keys. App credentials exist (build keystore) but `googleServiceAccountKeyForSubmissions` is **not linked**. No local Play SA JSON found (project, Downloads, Documents, `.expo`, parent `release-artifacts`, SMB name-match). Cursor browser could not open `https://play.google.com/console` (tab create then vanish / “No browser tab available”).

Current tester program: **not mutated**.

## Operator finish (Closed Testing only)

Do **not** submit Production. Do **not** use `--track production`.

1. First-time EAS Google SA setup (interactive TTY), then:

```
cd C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC
npx eas-cli submit --platform android --id b0425996-1697-427d-8c47-be8a437f042b
```

When prompted, choose track **alpha** / Closed Testing. Do not choose Production.

2. Or Play Console as the Play developer: existing **Alpha / Closed Testing** track → upload  
`docs/ops/android-v10-closed-testing/aab/umtuba-android-production-b0425996.aab`  
Do not create a new track. Do not reset testers. Do not Apply for production.

## What was NOT done

- Google Play upload / processing
- Production release / Apply for production
- Tester list changes
- Merge of `74188be` / iOS buildNumber 7
- New feature commit after `9e04a97`
- Remote versionCode increment to 11
- Writes to the Windows Desktop
- `_port_extract` untouched

## Security

- No secrets, tokens, `.env`, keystore passwords, or service-account JSON printed or committed
- Raw EAS JSON with signed artifact URLs deleted from this packet
- AAB preserved under `docs/ops` only
