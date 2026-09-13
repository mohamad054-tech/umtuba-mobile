# DESKTOP_FOLD6_CONTAIN_FIT_INSTALL_RETRY_V1

Install/QA packet. Updated 2026-08-29 shutdown persist. Owner-confirmed PASS.

```
TASK_ID = DESKTOP_FOLD6_CONTAIN_FIT_INSTALL_RETRY_V1
STATUS = PASS
SOURCE_SHA = 703740b85048d4d14ea6ffb1e322f33b33d24a48
BUILD_FAILURE_ROOT_CAUSE = LOCAL_GRADLE_DISK_AND_WIN260_PATH; EAS_NEVER_STARTED_UNTIL_RETRY
BUILD_ONLY_FIX_REQUIRED = NO
BUILD_SHA = 703740b85048d4d14ea6ffb1e322f33b33d24a48
APK_BUILD = PASS
APK_PATH_OR_BUILD_ID = b2b0bbd8-13e3-43d1-9a1f-c61bddf9ff13 | docs/ops/fold6-contain-fit-install-retry-v1/umtuba-703740b-b2b0bbd8.apk
FOLD6_CONNECTED = YES
DEVICE = Galaxy Z Fold6 SM-F956B
NEW_APK_INSTALLED = YES
INSTALLED_BUILD_VERIFIED = YES
INSTALLED_VERSION_NAME = 1.0.22
EAS_PREVIEW = b2b0bbd8
INSTALLED_COMMIT = 703740b
OLD_CROPPED_VIDEO_APK_1_0_0 = NO
FOLDED_CONTAIN_FIT = PASS
UNFOLDED_CONTAIN_FIT = PASS
VIDEO_CROPPED = NO
ASPECT_RATIO_PRESERVED = YES
PLAYBACK = PASS
SWIPE = PASS
AUTO_ADVANCE = PASS
THREE_VIDEO_CACHE = PASS
CRASH = NO
PLAY_UPLOAD = NO
DEPLOYED = NO
BLOCKERS = NONE
```

## Installed identity

- Package: `com.umtuba.app`
- versionName: **1.0.22**
- EAS preview: `b2b0bbd8-13e3-43d1-9a1f-c61bddf9ff13`
- git: `703740b85048d4d14ea6ffb1e322f33b33d24a48`
- Local APK (this folder): `umtuba-703740b-b2b0bbd8.apk`
- Device: Galaxy Z Fold6 SM-F956B
- Not the old 1.0.0 cropped-video APK

## Build path

Local Gradle failed first (disk + Win260 path). EAS never started until the retry. No build-only source fix. Same SHA built remotely.

EAS remote `versionCode` on this lineage is still historically **20**. Must fix `versionCode` before any Play upload. **NO Play upload. NO production Android release.**

## Device evidence in this folder

Folded cover (agent-captured):

- `01-after-launch.png`
- `01-folded-launch-clean.png`
- `02-folded-swipe.png`
- `03-folded-back.png`
- `04-folded-seek.png`
- `05-folded-autonext.png`

`06-inner-try.png` is the earlier ADB inner-panel attempt (display was off / black). It does **not** override owner confirmation: unfolded contain/FIT = **PASS**.

## Owner confirmation

Owner said the video is fine, then asked to save everything before shutting down the PC. Recorded as OWNER-CONFIRMED PASS for folded + unfolded contain/FIT.

## Related (not this APK)

- Watch V3 3-window worktree `DESKTOP-ANDROID-WATCH-NEXT-VIDEO-TRANSITION-DELAY-V1` (`1a4b0f8` / earlier QA `da449c9`) — historical vs current 1.0.22 install.
- Android post-edit worktree `DESKTOP-ANDROID-POST-PUBLISH-EDITING-V1` — APK **not** installed. Phone still lacks Edit/trim.

Coordinator resume: `C:\Users\1\Desktop\umtuba\umtuba-web\docs\ai\SESSION_CLOSE_HANDOFF_2026-08-29.md`.
