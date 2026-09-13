# DESKTOP_ANDROID_V10_FINAL_DEVICE_RESUME_V1

**DATE:** 2026-08-17  
**DEVICE:** DESKTOP / Galaxy Z Fold6 `RFCX718LVHK` / SM-F956B / product `q6qxxx` / cover 968×2376  
**WORKTREE:** `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-V9-LOC`  
**BRANCH:** `office/android-v10-clean-candidate-v1` (local only; not pushed)  
**SOURCE_SHA:** `9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d`  
**PREVIEW_BUILD_ID:** `8a6c491f-e710-4439-9138-98b355db368a`  
**APK:** `docs/ops/android-v10-clean-candidate/apk/umtuba-android-preview-8a6c491f.apk`  
**APK_SHA256:** `A44C551FF9B9E2F2581FE02EC8AB6E2CC1D80E7CFE9ECF50DCC8881F4265493C` (re-verified this pass)  
**PLAY_UPLOAD:** NO  
**PRODUCTION_SUBMISSION:** NO  
**RELEASE_AUTHORIZATION:** HOLD  

No rebuild. No versionCode 11. No source edit. No new commit. No push. Same installed package (`lastUpdateTime` 2026-08-16 23:44:19).

## Binary verification (this pass)

`adb devices -l`:

```
List of devices attached
RFCX718LVHK            device product:q6qxxx model:SM_F956B device:q6q transport_id:3
```

`dumpsys package com.umtuba.app`:

```
versionCode=10 minSdk=24 targetSdk=36
versionName=1.0.0
```

Installed APK is still preview `8a6c491f` / source SHA `9e04a97`. File hash match. Not reinstalled.

Evidence: `fold6-resume/adb-devices-final.txt`, `fold6-resume/dumpsys-package-final.txt`, `fold6-resume/apk-sha256-final.txt`.

## Remaining gates

| Gate | Result | Evidence |
|---|---|---|
| DEVICE_RESTART_SESSION | **PASS** | Pre-reboot `@playreview` (`01`). `adb reboot`. Device returned. App still authenticated (`03`). |
| RESET_OVERRIDE_USES_DEVICE | **PASS** | Deutsch override → Gerätesprache verwenden → Arabic device locale (`15`/`16`). Then EN for functional gates (`20`). |
| UNSUPPORTED_LOCALE_FALLBACK | **BLOCKED_DEVICE** | Changing Fold6 system locale away from ar-AE is not safely testable. Unit tests cover English fallback. Allowed by GO. |
| FOLLOW_FOLLOWING | **PASS** | Watch `@mohamad` → Profile → **Follow** → **Following** (`24`/`25`). |
| UNFOLLOW | **PASS** | Following → **Follow** (`26`). Product never shows Unfollow. |
| REAL_UPLOAD | **PASS** | Create picked MediaStore `1000442357.mp4` (navy 3s). Caption `V10_FOLD6_QA_safe_navy_test_clip_20260817`. UGC checked. **Video published.** (`32`–`35`). |
| PUBLISHED_POST_ID | **NOT_EXPOSED_NUMERIC** | Not in UI or app logcat. Identified by unique caption + `@playreview` + 3s navy + owner Delete. |
| OPEN_AFTER_UPLOAD | **PASS** | Tapped **Open Watch** (not Watch tab). Immediate Watch (`36`). |
| OPEN_TARGET_EXACT_POST | **PASS** | First card is the new navy post, that caption, `@playreview`, owner **Delete**, clock `0:00`/`0:03`. Wallet 0→25 UM. |
| UPLOADED_VIDEO_PLAYBACK | **PASS** | Clock advanced to `0:02`/`0:03` (`38`). |
| BACKGROUND_RESUME | **PASS** | HOME then `am start`. Same PID `29440`. Returned to same navy post (`39`/`40`). |
| LOGOUT_REOPEN | **PASS** | Settings → Sign out → confirm. Login **Welcome back**. Close/reopen + force-stop/reopen still login (`45`–`47`). |
| CRASH_ANR | **PASS** | `logcat -b crash` empty. No `FATAL EXCEPTION` / `ANR in com.umtuba`. |
| FUNCTIONAL_SMOKE | **PASS** | Follow + Create/Open + playback + bg/resume + logout. |
| DEVICE_LOCALIZATION_QA | **PASS** | Prior FR/EN/ES/PT/DE/AR walks not redone (no regression). Reset override PASS. Unsupported locale BLOCKED_DEVICE only. |

## DEVICE_QA_RESULT

**PASS.** All required remaining gates PASS. BLOCKED_DEVICE on unsupported-locale only is acceptable.

**ANDROID_CLEAN_CANDIDATE_READY_FOR_CENTRAL_DECISION = YES**

Central still holds Play / Production / release authorization.

## Session / clip

- Session: `@playreview` / Play Reviewer (Spark). After publish wallet **25 UM**.
- Safe clip: `/sdcard/DCIM/Camera/umtuba-v7-qa-safe-clip.mp4` (35440 bytes) / MediaStore `_id=1000442357`.
- Picker duration display `3000s` is the known Photos metadata quirk; actual playback is 3s.

## UI method

scrcpy not present. Operated via adb tap + screencap + uiautomator. Watch dumps require pause (uiautomator idle). Username tap target `@mohamad` `[42,1757][678,1821]`.

## Not done (by GO)

- No rebuild / no versionCode 11
- No merge of `74188be`
- No Play upload / no Production submit
- No source change / no new commit / no push
