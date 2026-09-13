# DESKTOP_ANDROID_CLEAN_CANDIDATE_CLOSEOUT_V1

**DATE:** 2026-08-16  
**DEVICE:** DESKTOP / Galaxy Z Fold6 `RFCX718LVHK` / SM-F956B / product `q6qxxx`  
**WORKTREE:** `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC`  
**BRANCH:** `office/android-v10-clean-candidate-v1` (local only; not pushed)  
**PLAY_UPLOAD:** NO  
**PRODUCTION_SUBMISSION:** NO  
**RELEASE_AUTHORIZATION:** HOLD  

## P0 — commit

```
BASE_SHA = 2f0628cf8fd4ea2246366fb8cc919962188186a9
SESSION_FIX_COMMIT = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
FINAL_SOURCE_SHA = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
TREE_CLEAN = yes
NEW_VERSION_CODE = 10
IOS_BUILD_NUMBER = 6
```

Commit message:

```
fix(android): persist session and close reproduced loc leaks

Keep a durable AsyncStorage session copy so Android Keystore miss cannot drop the refresh token, and ignore null INITIAL_SESSION during hydrate. Localize auth email validation and Live empty body, and stop German Nachrichten tab truncation. Stamp versionCode 10; leave iOS buildNumber at 6.
```

Files changed (8):

- `src/lib/supabase/authStorage.ts`
- `src/lib/supabase/authStorage.test.ts`
- `src/lib/supabase/client.ts`
- `src/lib/auth/AuthContext.tsx`
- `app/(tabs)/live.tsx`
- `app/(tabs)/_layout.tsx`
- `app.config.ts`
- `src/lib/ios/appStoreConfig.test.ts`

`git fetch --prune` saw `origin/central/mobile-reconcile-ios-android-v1` move to `74188be` (iOS buildNumber 7). Not merged / not FF’d.

## P1 — clean preview APK

```
PREVIEW_BUILD_ID = 8a6c491f-e710-4439-9138-98b355db368a
BUILD_SOURCE_SHA = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
VERSION_NAME = 1.0.0
NEW_VERSION_CODE = 10
APK_PATH = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC\docs\ops\android-v10-clean-candidate\apk\umtuba-android-preview-8a6c491f.apk
APK_SHA256 = A44C551FF9B9E2F2581FE02EC8AB6E2CC1D80E7CFE9ECF50DCC8881F4265493C
APK_SIZE = 148156580
```

Approved path: `npx eas-cli build --platform android --profile preview --non-interactive`. Never production submit.

Fold6 install: `adb uninstall com.umtuba.app` Success; `adb install` Success; dumpsys `1.0.0` / versionCode **10**.

## P2 — Fold6 gates (exact v10)

`adb devices -l` at install:

```
RFCX718LVHK            device product:q6qxxx model:SM_F956B device:q6q transport_id:1
```

scrcpy: **NOT_PRESENT**. Walked with adb tap + screencap + uiautomator.

| Gate | Result | Evidence |
|---|---|---|
| Cold launch | PASS | `fold6/00-cold-launch*` Arabic RTL login; pid live; no LocalizationModule crash |
| Login once | PASS | `@playreview` profile `03-logged-in-profile*` |
| Close/reopen | PASS | `04-close-reopen` still `@playreview` |
| Force-stop/reopen | PASS | `05-force-stop-reopen` still logged in |
| Background/resume | PASS | `06-background-resume` still logged in |
| Device restart session | BLOCKED | USB adb dropped before `adb reboot` |
| Logout → reopen | BLOCKED | adb dropped |
| No plaintext password | PASS (source) / runtime scan BLOCKED | release APK not debuggable; Samsung Pass dismissed |
| Auth EN leakage | PASS | `01-invalid-email` Arabic `يرجى إدخال بريد إلكتروني صالح.` |
| Live EN leakage | PASS | DE `27-de-live-nodes` catalog body; EN `34-en-live-nodes`; FR `41-fr-live` |
| German Nachrichten overflow | PASS | full `Nachrichten` in tab bounds `[660,2208][791,2241]`; screenshot `25-de-profile.png` |
| French / English / Spanish / Portuguese chrome | PASS | `40-fr` / `32-en`+`33`+`34` / `42-es` / `43-pt` |
| Arabic/RTL spot-check | PASS | `00` + `03` + `13-settings-open` |
| Reset override → device | PARTIAL | `Gerätesprache verwenden` / `Use device language` visible; final tap not completed |
| Unsupported locale → EN | UNIT_PASS / DEVICE_BLOCKED | i18n tests; system locale not switched to ja |
| Raw / missing keys | NOT_OBSERVED | walked screens |
| UI overflow | PASS | tested chrome; Nachrichten no longer `Nachrich...` |
| Watch/playback | PASS | `50-en-watch.png` `@mohamad` 0:01/0:08 playing |
| Saved | PARTIAL | star visible; tap not confirmed |
| Other-user Profile | PARTIAL | `@mohamad` on Watch; profile not opened |
| Follow / Following / unfollow | BLOCKED | adb dropped |
| Messages | PASS | DE/EN empty states |
| Create / publish / Open exact post / uploaded playback | BLOCKED | adb dropped before Create |
| Account deletion entry | PASS | Settings `حذف الحساب` |
| UGC report/block | PASS | Watch overlay Report + Block visible |
| Crash/ANR | PASS | tested launches; no FATAL/ANR observed |

Last `adb devices -l` this session: **empty**. Device no longer attached.

## Verdict

```
DEVICE_QA_RESULT = PARTIAL
ANDROID_CLEAN_CANDIDATE_READY_FOR_CENTRAL_DECISION = NO
```

Old v9 preview is **not** final evidence. Clean SHA + v10 APK exist. Fold6 required upload/Open + logout + reboot rows are missing.

## Central action

1. Do **not** upload Play / submit Production. HOLD.
2. Reconnect Fold6 USB. Finish remaining gates on **this same** APK `8a6c491f` / SHA `9e04a97` / versionCode **10**.
3. Do not reuse versionCode 9. Do not merge `74188be` (iOS 7) into this candidate.
