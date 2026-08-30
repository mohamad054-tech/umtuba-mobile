# UMTUBA Project State (AI Handoff) — Fold6 contain/FIT worktree

## LAST ASSIGNED TASK (2026-08-30) — WATCH INTERACTION FOUNDATION V1 PART 1B

**`DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1B_IMPLEMENTATION`**. STATUS = **IMPLEMENTATION_COMPLETE / DEVICE_QA_NOT_RUN**. Isolated branch `desktop/watch-interaction-foundation-v1-part1b` from `703740b`. Double-tap Like + tap classifier + refresh gate. Playback/preload frozen. Uncommitted. No deploy. No Play/App Store.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1B_IMPLEMENTATION
STATUS = IMPLEMENTATION_COMPLETE
BASE_SHA = 703740b85048d4d14ea6ffb1e322f33b33d24a48
RESULT_SHA = UNCOMMITTED
BRANCH = desktop/watch-interaction-foundation-v1-part1b
IMPLEMENTED = YES
DEPLOYED = NO
PLAY_UPLOAD = NO
APP_STORE_UPLOAD = NO
```

## PRIOR SESSION (2026-08-29) — FOLD6 CONTAIN FIT INSTALL RETRY V1

**`DESKTOP_FOLD6_CONTAIN_FIT_INSTALL_RETRY_V1`**. STATUS = **PASS** / **CLOSED**. Owner-confirmed. Installed FIT build is EAS preview `b2b0bbd8` at commit `703740b`, versionName **1.0.22**, on Galaxy Z Fold6 SM-F956B. Not the old cropped-video 1.0.0 APK. Folded + unfolded contain/FIT PASS. No Play upload. No deploy. No product-code change this close-out.

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
DEVICE = Galaxy Z Fold6 / SM-F956B
NEW_APK_INSTALLED = YES
INSTALLED_BUILD_VERIFIED = YES
INSTALLED_VERSION_NAME = 1.0.22
EAS_PREVIEW = b2b0bbd8
INSTALLED_COMMIT = 703740b
OLD_CROPPED_VIDEO_APK = NO
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
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
```

## Installed FIT build facts

- **Worktree:** `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1`
- **Source / build SHA:** `703740b85048d4d14ea6ffb1e322f33b33d24a48`
- **EAS preview:** `b2b0bbd8-13e3-43d1-9a1f-c61bddf9ff13`
- **Local APK:** `docs/ops/fold6-contain-fit-install-retry-v1/umtuba-703740b-b2b0bbd8.apk`
- **Device:** Galaxy Z Fold6 SM-F956B
- **Installed identity:** `com.umtuba.app` versionName **1.0.22** / EAS preview `b2b0bbd8` / commit `703740b`
- **First local Gradle attempt:** failed on disk + Win260 path. EAS did not start until the retry. Build-only source fix was **not** required.
- **EAS remote versionCode** on this preview lineage remains historically **20**. Installed marketing version is **1.0.22**. Must bump `versionCode` before any Play upload. **NO Play upload.**
- **Contain/FIT:** letterbox, aspect preserved, not cropped. Owner: video is fine.
- **Playback / swipe / auto-advance / 3-video cache:** PASS. Crash: NO.

## Official production / git (coordinator — do not confuse with this worktree)

- Official remote: `origin/alpha-0.2`
- Live + official SHA: `b5fbeff29cb0f308481b38c06500c572cd44a9c4`
- `origin/main` does not exist. Production is Hetzner.
- Do not invent `ANON_KEY`. House key is `PUBLISHABLE_KEY`.
- Brand Phase 2 rebased onto alpha as `b5fbeff` and deployed.
- Parent web checkout `C:\Users\1\Desktop\umtuba\umtuba-web` remains `office/profile-hero-completeness-v1` @ `380a36646d4de8a37c39a56ac3ccd449f6d8b20d` — dirty; do not reset/clean/stash.

## Other live threads (not this worktree)

- Android Watch next-video / 3-window: `DESKTOP-ANDROID-WATCH-NEXT-VIDEO-TRANSITION-DELAY-V1` — V3 cache SHA `1a4b0f8…` / earlier Fold6 QA `da449c9…`. Phone now has FIT 1.0.22, not that older V3 APK.
- Web post-edit: `DESKTOP-UMTUBA-POST-PUBLISH-EDITING-V1`, local preview `:3032`, NOT deployed. Owner Edit on Watch; delete stays inside Edit.
- Android post-edit: `DESKTOP-ANDROID-POST-PUBLISH-EDITING-V1` — APK was **NOT** installed. Separate from FIT. Phone still lacks Edit/trim until that APK lands.

## Safety

- No Play Store. No Android production release from this FIT APK.
- No web/iOS changes for this close-out.
- Never write artifacts to the Windows Desktop. Never touch `_port_extract`.
- Never reset the dirty parent `umtuba-web` checkout.
