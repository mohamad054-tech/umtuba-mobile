# DESKTOP ANDROID V9 COLD-LAUNCH + LOCALIZATION + SESSION PERSISTENCE

**DATE:** 2026-08-16  
**DEVICE:** DESKTOP / Galaxy Z Fold6 `RFCX718LVHK` / SM-F956B / product `q6qxxx`  
**WORKTREE:** `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC`  
**PARENT MOBILE:** left dirty at `3b33561` — not used  
**PLAY_UPLOAD:** NO  
**PRODUCTION_SUBMISSION:** NO  
**CENTRAL_RELEASE_AUTHORIZATION:** HOLD  

## A1 — V9 PREVIEW BUILD

```
TASK_ID = DESKTOP_ANDROID_V9_PREVIEW_BUILD_V1
SOURCE_SHA = 2f0628cf8fd4ea2246366fb8cc919962188186a9
VERSION_NAME = 1.0.0
VERSION_CODE = 9
IOS_BUILD_NUMBER = 6
EXPO_LOCALIZATION_VERSION = 57.0.1
PREVIEW_BUILD_ID = 1a1b51c7-adbe-4f30-a7dd-97ce14cd7a3d
BUILD_SOURCE_SHA = 2f0628cf8fd4ea2246366fb8cc919962188186a9
APK_PATH = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC\docs\ops\android-v9-preview-fold6-qa\apk\umtuba-android-preview-1a1b51c7.apk
APK_SHA256 = DF047CA4D3EC1FF19A77989DD2F6750E140131DA6671968D73FFC5412CAB78FB
APK_SIZE = 148154716
```

- `git fetch --prune` on `umtuba-mobile`; SHA on `origin/central/mobile-reconcile-ios-android-v1`
- Detached worktree; `git rev-parse HEAD` = `2f0628cf8fd4ea2246366fb8cc919962188186a9`
- `app.config.ts`: version `1.0.0` / `android.versionCode` 9 / iOS `buildNumber` 6
- `package.json` + lockfile + `node_modules/expo-localization` = **57.0.1** (not 17.0.9)
- Remote EAS versionCode was 8; interactive `build:version:set` failed (no TTY). Non-interactive GraphQL set to **9** (script `set-remote-versioncode-9.js`). Then preview built as 9.
- Approved path: `npx eas-cli build --platform android --profile preview --non-interactive` (no submit)

## A2 — FOLD6 COLD LAUNCH

```
TASK_ID = DESKTOP_ANDROID_V9_FOLD6_COLD_LAUNCH_V1
adb devices -l =
List of devices attached
RFCX718LVHK            device product:q6qxxx model:SM_F956B device:q6q transport_id:1
FOLD6_COLD_LAUNCH = PASS
PROCESS_STAYS_ALIVE = YES
CRASH_ANR = PASS
LOCALIZATIONMODULE_CRASH = NOT_REPRODUCED
INSTALLED_VERSION_CODE = 9
```

- `adb uninstall com.umtuba.app` Success (removed v8)
- `adb install` of `1a1b51c7` Success
- dumpsys: `versionName=1.0.0` `versionCode=9` `minSdk=24` `targetSdk=36`
- Five force-stop + `am start -W` cycles: each left a live pid; no Application Error window
- Launch 4 focused `com.umtuba.app/.MainActivity`
- logcat: no v9 `LocalizationModule` / `NoSuchMethodError` / FATAL
- dropbox last `LocalizationModule` crash is **v8** (`Package: com.umtuba.app v8`) at 2026-08-16 20:22:41
- tombstones: none from 2026-08-16
- ANR dir: last entry 2026-06-22

## A3 — LOCALIZATION + FUNCTIONAL

```
TASK_ID = DESKTOP_ANDROID_V9_FOLD6_LOC_QA_V1
SCRCPY = NOT_PRESENT
DEVICE_SYSTEM_LOCALE = ar-AE (persist.sys.locale; system_locales ar-AE,en-GB)
```

Walked with adb tap + screencap + uiautomator (cover 968×2376).

| Check | Result | Evidence |
|---|---|---|
| Arabic auto + RTL + back/chevrons | PASS | Login `مرحبًا بعودتك`; back `›` top-right; tabs شاهد/اكتشف/إنشاء/الرسائل/الملف |
| German long strings | PASS | `Automatisch weiter an`, `Erneut versuchen`, `Abmelden`, `Ansehen` |
| French wrapping | PARTIAL | Listed on language selector only |
| EN / ES / PT nav | PARTIAL | Selector lists all six; full surface walk not completed |
| Device locale detection | PASS | ar-AE → Arabic with no override |
| Unsupported → English | UNIT_PASS / DEVICE_BLOCKED | i18n tests cover fallback; system locale not switched to ja |
| Manual override | PASS | Deutsch selected; chrome became German |
| Override persistence | PASS | Force-stop reopen still German Watch |
| Reset override → device | PARTIAL | `Gerätesprache verwenden` present; later tap missed |
| UI overflow | FAIL | German `Nachrichten` → `Nachrich...`; Watch remaining time can overlap slider |
| English leakage | FAIL | Auth `Please enter a valid email address.` (hardcoded). Live body English while chrome German. Brand `Rising` / `UM` / `UMTUBA` treated as brand |
| Missing / raw keys | NOT_OBSERVED | Walked screens |
| RTL navigation | PASS | Arabic back/chevrons/tabs |
| Functional smoke | PARTIAL | Login, Watch playback, Saved star, Profile @mohamad, Settings, Create form, Live empty. No new upload |
| Open after upload | NOT_TESTED | No Create publish this session |

Catalogs were **not** patched.

## Session persistence extra gate

**User report:** Android asks for email/password again after reopen.

**Root cause (shared code, Android-visible):** `ExpoSecureStoreAdapter.setItem` wrote SecureStore then **deleted** the AsyncStorage copy. Android EncryptedSharedPreferences/Keystore can later return null/throw (reinstall, key rotation, decrypt desync). getItem then had nothing to fall back to. iOS Keychain is more tolerant, matching “iOS keeps session, Android does not.” Session JSON also often exceeds the historical ~2KB SecureStore ceiling.

**Additional race:** `onAuthStateChange(INITIAL_SESSION, null)` could apply signed-out during hydrate.

**Fix (uncommitted, shared):**
- Always keep a durable AsyncStorage copy of the session JSON (refresh token inside session blob; **never** store password)
- Also write SecureStore only when payload ≤ 1800 bytes
- getItem: SecureStore if usable, else AsyncStorage
- removeItem (logout) clears both
- Ignore null `INITIAL_SESSION` while `restore()` is hydrating

**Installed v9 `1a1b51c7` already kept session** across force-stop/reopen and home/resume after play-review login. The adapter hole is still real; fix shipped in dirty-tree preview `81032f62` (versionCode 9, `adb install -r`). That APK also kept session across login + force-stop (`@mohamad` Watch still playing).

```
ROOT_CAUSE = SecureStore success deleted AsyncStorage; Android Keystore desync then drops session. INITIAL_SESSION(null) could clobber hydrate.
ANDROID_ONLY_OR_SHARED = SHARED
FILES_CHANGED = src/lib/supabase/authStorage.ts, src/lib/supabase/authStorage.test.ts, src/lib/supabase/client.ts, src/lib/auth/AuthContext.tsx
SESSION_STORAGE = AsyncStorage durable copy + optional SecureStore
SECURE_STORAGE = expo-secure-store when utf8 bytes <= 1800
REFRESH_TOKEN_PERSISTENCE = YES (session JSON; not password)
COLD_START_HYDRATION = restore() + skip null INITIAL_SESSION during hydrate
SOURCE_FIX = YES_UNCOMMITTED
SOURCE_SHA = 2f0628cf8fd4ea2246366fb8cc919962188186a9
NEW_BUILD_REQUIRED = NO_FURTHER (81032f62 already built/installed; commit still needed for a clean SHA)
FOLD6_SESSION_PERSISTENCE = PASS
ANDROID_SESSION_PERSISTENCE = PASS
LOGIN_ONCE = PASS
CLOSE_APP_REOPEN = PASS
FORCE_STOP_REOPEN = PASS
BACKGROUND_RESUME = PASS
DEVICE_RESTART_REOPEN = BLOCKED
SESSION_REFRESH = PARTIAL
LOGOUT_THEN_REOPEN = PARTIAL
SECURITY_RESULT = PASS
```

FIX APK: `apk/umtuba-android-preview-81032f62-session-fix.apk`  
SHA256 `DBF5D67FE171CAF386EC8DCABE7E8F3FBDA675E13B25A1862822C7AB3E51F7AD`  
SIZE `148156252`

## Central action

1. Do **not** upload Play / submit Production. HOLD.
2. Review uncommitted session-storage fix; commit on Central GO if accepted.
3. Localization defects are report-only (no catalog patch): auth English validation; Live English body; German tab truncation.
4. Optional: complete logout-confirm + device-reboot session rows; FR/ES/PT full walk.
