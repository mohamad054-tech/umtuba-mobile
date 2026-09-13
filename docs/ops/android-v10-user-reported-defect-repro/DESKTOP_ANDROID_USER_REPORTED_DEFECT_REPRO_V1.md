# DESKTOP_ANDROID_USER_REPORTED_DEFECT_REPRO_V1

**DATE:** 2026-08-17  
**STATUS:** SUPERSEDED  
**REASON:** Central issued a new GO for Android v11 surgical Fold6 QA from SHA `7b33bae`. This v10 repro stopped immediately. Device not uninstalled. Source not modified. No rebuild. No Play upload.

```
TASK_ID = DESKTOP_ANDROID_USER_REPORTED_DEFECT_REPRO_V1
STATUS = SUPERSEDED
DEVICE = Galaxy Z Fold6 RFCX718LVHK / SM-F956B
INSTALLED_VERSION_NAME = 1.0.0
INSTALLED_VERSION_CODE = 10
INSTALLED_SOURCE_SHA_IF_KNOWN = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
SOURCE_CHANGED = NO
FIX_IMPLEMENTED = NO
PLAY_UPLOAD = NO
PRODUCTION_SUBMISSION = NO
```

Last authorized install consumed: versionName 1.0.0 / versionCode 10 / SOURCE_SHA `9e04a97` / preview APK `8a6c491f` / AAB `b0425996`. dumpsys at start: `com.umtuba.app` 1.0.0 / versionCode 10 / lastUpdateTime 2026-08-16 23:44:19.

Session used: `@playreview` (Play Reviewer). Wallet UI **25 UM / Spark**. Device locale Arabic (RTL clock). App language override started as English, later switched to Arabic (visible UI change + restart persistence). **Use device language / signup-for-100-points not finished.**

Evidence root: `docs/ops/android-v10-user-reported-defect-repro/` (screenshots + dumps). `_port_extract` untouched. Nothing written to the Windows Desktop.

## Defect 1 — Create retains previous video state after successful upload

REPRODUCED = YES  
EXACT_STEPS = Sign in `@playreview` → Create → picker 00:03 QA clip (16/08 18:02) → confirm تم → caption `V10_DEFECT1_safe_navy_20260817` → UGC check → Publish → success → Watch tab (not Open Watch / not Create another) → Create tab again.  
EXPECTED = After successful publish, a new Create session starts empty (no prior asset/caption/success state).  
ACTUAL = Success screen and return-to-Create both still show `1000442498.mp4`, caption, UGC checked, and **Video published.** / Open Watch / Create another.  
SCREEN_SURFACE = Create tab  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = SHARED_MOBILE (Create `useState` is not reset on `completePublish`; tab stays mounted)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/01n-after-publish-tap.png`, `screenshots/01p-second-create-after-success.png`, dumps `01n-*` / `01p-*`

FIRST_ASSET_IDENTITY = `1000442498.mp4` (picker 00:03 navy QA; UI duration `3000s` known ImagePicker quirk)  
FIRST_ASSET_DURATION = picker 00:03 / UI `3000s`  
FIRST_PUBLISH_RESULT = SUCCESS (`Video published.`)  
FIRST_PUBLISHED_POST_ID_OR_CAPTION = caption `V10_DEFECT1_safe_navy_20260817` / `@playreview` (numeric id not exposed)  
SECOND_CREATE_INITIAL_STATE = same asset + caption + success chrome still present  
PREVIOUS_ASSET_STILL_VISIBLE = YES  
PREVIOUS_CAPTION_STILL_VISIBLE = YES  
PREVIOUS_UPLOAD_STATE_STILL_VISIBLE = YES  
OWNERSHIP = SHARED_MOBILE

## Defect 2 — New user missing expected 100 points

REPRODUCED = NOT_FINISHED  
ACCOUNT_CREATION_RESULT = NOT_FINISHED (signup not exercised; Central stop)  
EXPECTED_INITIAL_POINTS = 100  
BACKEND_BALANCE = NOT_VERIFIED  
BACKEND_BALANCE_SOURCE = NOT_VERIFIED  
UI_DISPLAYED_BALANCE = 25 UM on existing `@playreview` only (not a new account)  
UI_SURFACE = Profile / Watch wallet pill  
CLASSIFY = NOT_FINISHED  
OWNERSHIP = UNKNOWN

Do not infer backend failure from the existing Play Reviewer 25 UM balance.

## Defect 3 — Over-duration video still allows Publish / Retry uses stale asset

OVER_DURATION: REPRODUCED = YES  
RETRY_STALE_ASSET: REPRODUCED = NO (Retry cleared after new pick; Retry not tapped on 90s; STOP before publication)

EXACT_STEPS = After defect 1, Choose a different video → picker 01:30 generated navy `umtuba-v10-qa-long-90s.mp4` → confirm. Did **not** tap Publish. Separate safe Retry path: airplane mode + Publish on 3s → `Publish failed` / Retry → then pick 90s (Retry disappeared). Airplane restored.  
EXPECTED = Over-duration clip should disable Publish; Retry should not silently target a stale asset.  
ACTUAL = 90s clip accepted. UI showed `1000443085.mp4` / `0.8 MB · 90000s · video/mp4`. Publish button enabled (white). No duration error. Caption from defect 1 still filled.  
SCREEN_SURFACE = Create  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = SHARED_MOBILE (contract `validateVideoDuration` has no hard max; ImagePicker seconds×1000 display quirk)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/03c-long-90s-selected.png`, `screenshots/03f-publish-airplane-error.png`, `screenshots/03h-retry-after-new-asset.png`

LONG_VIDEO_ASSET_IDENTITY = `1000443085.mp4` / `/sdcard/DCIM/Camera/umtuba-v10-qa-long-90s.mp4` (generated navy+tone, 888664 bytes, ffmpeg Duration 00:01:30)  
LONG_VIDEO_DURATION = picker 01:30 / UI `90000s`  
MAX_ALLOWED_DURATION = UI copy “short video” + 50 MB only; no numeric max shown  
PUBLISH_ENABLED = YES  
PUBLISH_DISABLED_REASON = NONE  
PUBLISH_ATTEMPT_RESULT = STOPPED_BEFORE_PUBLICATION  
RETRY_VISIBLE = YES on airplane 3s fail; NO after picking 90s  
RETRY_TARGET_IDENTITY = 3s `1000442498.mp4` while Retry shown; after new pick current asset `1000443085.mp4` and Retry gone  
RETRY_USES_CURRENT_ASSET = NOT_TAPPED  
RETRY_USES_STALE_ASSET = NO_EVIDENCE  
OWNERSHIP = SHARED_MOBILE

## Defect 4 — False red Like state

REPRODUCED = YES  
EXACT_STEPS = After login, Watch opened. **Like was not tapped** before first capture.  
EXPECTED = Unliked post shows a non-liked (not red/selected) heart.  
ACTUAL = `@eman` post heart visually red, count 0, a11y **Like** `selected=false`. Later Arabic Watch still a11y **إعجاب** (Like), not Unlike. Own published navy post also showed a red heart with 0 on restart screenshot.  
SCREEN_SURFACE = Watch rail  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = LIKELY_SHARED_UI (filled `♥` + white/`#8b5cf6` token; visual reads red while unliked)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/04-watch-initial-like-state.png`, `screenshots/04b-watch-paused.png`, dumps `04b-watch-paused-*`

VIEWER_ACCOUNT = `@playreview`  
POST_ID_OR_IDENTITY = `@eman` / caption `فرحاً بشيء ما _محمود درويش` / clock 0:50/2:00  
INITIAL_LIKE_COLOR = red (visual)  
INITIAL_UI_LIKED_STATE = unliked (`Like`, selected=false, count 0)  
BACKEND_VIEWER_LIKED = NOT_VERIFIED  
BACKEND_SOURCE = NOT_VERIFIED  
FALSE_RED_LIKE_REPRODUCED = YES  
UI_BACKEND_MISMATCH = UI_UNLIKED_VISUAL_RED; backend not queried  
ANDROID_SPECIFIC_OR_SHARED = LIKELY_SHARED_UI  
OWNERSHIP = LIKELY_SHARED_UI

Like was not toggled after initial evidence (stop interrupted follow-up).

## Defect 5 — Own Profile incomplete / Settings-like

REPRODUCED = YES  
EXACT_STEPS = Login lands on Profile. Opened Settings from SHORTCUTS.  
EXPECTED = Own Profile shows profile header/avatar/username/bio/stats/posts and a separate Settings entry.  
ACTUAL = Own Profile is identity + SHORTCUTS (Rewards / Notifications / Settings). No bio, no stats, no posts grid, no Edit Profile on Profile. Settings is a **separate** screen. Edit profile = **Not available yet**.  
SCREEN_SURFACE = Profile tab + Settings  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = LIKELY_SHARED_UI (`app/profile/index.tsx` own path renders shortcuts; bio only if present)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/05-own-profile-initial.png`, `screenshots/05b-settings-from-profile.png`, `screenshots/08g-arabic-profile.png`

PROFILE_ENTRY_PATH = post-login default + Profile tab  
PROFILE_SCREEN_CONTENT = Settings-like shortcuts, not a social profile  
PROFILE_HEADER = “Profile” / Arabic “الملف”  
PROFILE_AVATAR = letter U placeholder  
PROFILE_USERNAME = UMTUBA Play Reviewer / `@playreview`  
PROFILE_BIO = missing  
PROFILE_STATS = missing  
PROFILE_POSTS_OR_CONTENT = missing  
EDIT_PROFILE_ENTRY = Settings only, “Not available yet”  
SETTINGS_ENTRY_SEPARATE = YES  
OWNERSHIP = LIKELY_SHARED_UI

## Defect 6 — Share not working

REPRODUCED = YES  
EXACT_STEPS = Watch `@eman` → tap Share rail (`Share, coming soon` / `enabled=false`).  
EXPECTED = Android share sheet with a link/payload.  
ACTUAL = Button visible but disabled. Tap no-ops. No system share sheet.  
SCREEN_SURFACE = Watch rail  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = SHARED_MOBILE (`WatchVideoCard` share `disabled` + `watch.shareSoon`)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/06-share-tap.png`, dumps `06-share-tap-*`

SHARE_BUTTON_VISIBLE = YES  
SHARE_TAP_RESULT = NO_OP  
ANDROID_SHARE_SHEET_OPENED = NO  
LINK_OR_PAYLOAD_PRESENT = NO  
TARGET_APP_SELECTION_AVAILABLE = NO  
RETURN_TO_UMTUBA = STAYED  
ERROR = none (disabled “coming soon”)  
OWNERSHIP = SHARED_MOBILE

## Defect 7 — Comment not working

REPRODUCED = YES  
EXACT_STEPS = Watch `@eman` → tap Comments rail (`Comments, coming soon` / `enabled=false`). One tap only. No comment submitted.  
EXPECTED = Comment panel, input, submit, persist.  
ACTUAL = Button visible but disabled. Tap no-ops. Panel does not open.  
SCREEN_SURFACE = Watch rail  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = SHARED_MOBILE (`WatchVideoCard` comments `disabled` + `watch.commentsSoon`)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/07-comment-tap.png`, dumps `07-comment-tap-*`

COMMENT_ENTRY_VISIBLE = YES  
COMMENT_PANEL_OPENS = NO  
EXISTING_COMMENTS_LOAD = NO  
TEXT_INPUT_WORKS = NO  
SAFE_TEST_COMMENT_SUBMIT = NOT_ATTEMPTED (panel never opened)  
SUBMIT_RESULT = N/A  
COMMENT_APPEARS = NO  
REOPEN_PERSISTENCE = N/A  
ERROR = none (disabled “coming soon”)  
OWNERSHIP = SHARED_MOBILE

## Defect 8 — Language selector not working

REPRODUCED = NO (selector produced a visible UI change; reset-to-device not finished)  
EXACT_STEPS = Settings → Language (English override selected; device language العربية) → tap العربية. Force-stop + cold start. Profile after restart was Arabic. **Use device language not tapped** (Central stop).  
EXPECTED = Tapping a locale changes visible UI; restart persists; reset returns to device language.  
ACTUAL = Tap Arabic → strings + RTL + checkmark moved (`اللغة`, `شاهد`, `إنشاء`, `الملف`). Restart persisted Arabic Watch/Profile. Device locale was already Arabic; override vs device vs English fallback distinguished: start = English **override** on Arabic **device**.  
SCREEN_SURFACE = Settings / Language / Watch / Profile  
ANDROID_SPECIFIC_OR_SHARED_EVIDENCE = SHARED_MOBILE (in-app override works on this install)  
SCREENSHOT_OR_LOG_EVIDENCE = `screenshots/08c-language-selector.png`, `screenshots/08d-after-arabic-tap.png`, `screenshots/08e-restart-after-arabic.png`, `screenshots/08g-arabic-profile.png`

SELECTOR_VISIBLE = YES  
SELECTOR_TAP = YES (Arabic)  
AVAILABLE_LOCALES = العربية, English, Français, Español, Deutsch, Português + Use device language  
SELECTED_LOCALE = English override at open; العربية after tap  
VISIBLE_UI_RESULT = YES (English → Arabic)  
RTL_RESULT_IF_ARABIC = YES  
RESTART_PERFORMED = YES (force-stop + cold start)  
RESTART_PERSISTENCE = YES  
RESET_TO_DEVICE_LANGUAGE = NOT_FINISHED  
ERROR = none on exercised path  
OWNERSHIP = N/A (defect not reproduced on exercised path)

## Device / install

- `adb devices -l`: `RFCX718LVHK device product:q6qxxx model:SM_F956B`
- dumpsys: versionName 1.0.0 / versionCode 10
- Cover 968×2376. Operated via adb tap + screencap + uiautomator. scrcpy not used.
- Device released: install left as-is. No uninstall. Last UI: Arabic own Profile (`الملف`) after language persistence check.

## Not done (stop)

- New-account 100-point grant
- Language “Use device language”
- Like toggle follow-up
- Publishing the 90s clip (intentionally stopped)
- Rebuild / source change / Play / Production
