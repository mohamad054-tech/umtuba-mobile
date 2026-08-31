# Current Task

## Task title

DESKTOP_UMTUBA_WATCH_ANDROID_5_VIDEO_ROLLING_CACHE_AND_BINDING_FIX_V1

## Status

**SOURCE FIX COMMITTED. EAS PREVIEW IN FLIGHT ON EXPO. FOLD6 INSTALL + OWNER QA NOT DONE.**

Owner Fold6 QA on `3c2b747e` / `e03fab9` = **FAIL**. Do not claim black-video or binding fixed until new device evidence.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_ANDROID_5_VIDEO_ROLLING_CACHE_AND_BINDING_FIX_V1
PREVIOUS_3C2B747E_GATE = FAIL
PART1F_DEVICE_GATE = FAIL
SOURCE_SHA = 0b7e63c7bfe4689b249ad374e9189d35d8cec412
BASE_SHA = e03fab9e0c301446368c0a4d7ad0ddc4b5acba1b
BRANCH = desktop/watch-interaction-foundation-v1-part1f
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
EAS_BUILD_ID = 91e8f585-a853-48b8-9633-3bcba46b5d08
EAS_URL = https://expo.dev/accounts/umtuba/projects/umtuba-mobile/builds/91e8f585-a853-48b8-9633-3bcba46b5d08
EAS_STATUS = STARTED_ON_EXPO (upload done 2026-08-31 ~22:24 +3). Local CLI wait may die if Desktop shuts down. Cloud build continues.
ADB_INSTALL = NOT_DONE
OWNER_FOLD6_QA = NOT_DONE
WATCH_FOUNDATION_COMPLETE = NO
DEPLOYED = NO
PLAY_UPLOAD = NO
```

## Resume tomorrow (exact next steps)

1. Confirm Fold6 only: `adb devices` → serial **RFCX718LVHK**, model **SM-F956B**. Do not install to any other device.
2. Check EAS `91e8f585-a853-48b8-9633-3bcba46b5d08`. If FINISHED, download APK (do not ask owner to copy it):
   ```
   NODE_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection
   npx eas-cli build:download --build-id 91e8f585-a853-48b8-9633-3bcba46b5d08 --non-interactive --json
   ```
   Run from this worktree. Verify filename/metadata contains `91e8f585`.
3. If that build failed or never existed, start **ONE** new preview from `0b7e63c` with the same NODE_OPTIONS. Do not stack extra builds.
4. `adb -s RFCX718LVHK install -r <apk>`. Preserve app data. Do **not** uninstall UMTUBA.
5. Launch: `adb -s RFCX718LVHK shell monkey -p com.umtuba.app -c android.intent.category.LAUNCHER 1`
6. Stop. Owner Fold6 QA only. Do **not** claim PASS from unit tests. Do **not** run 1B/1C/1D/2x/sound QA.

## Root cause (code + owner FAIL on 3c2b747e)

Not the Part1F Modal. That fix is already on `e03fab9` / `3c2b747e` and still failed.

Android attached the next TextureView only when `warmNextSurface` (clip near end). Swipe 1→2 started the prepared item-2 ExoPlayer (audio) before VideoView mounted (black). Next swipe then showed item 2 picture. One-cell-late surface/index binding.

Existing cache was Media3 192MB LRU + 3-item prepare window + signed-URL window 10. Not a 5-item identity-keyed on-device window.

## Source fix on 0b7e63c

- Attach next Android TextureView as soon as the next player is READY (`isNextItem`), not only near-end warm.
- Player/cell keys use `watchItemKey` / post id, not list index as media identity.
- Extend `androidWatchMediaCache` to `ANDROID_WATCH_CACHE_TARGET = 5` rolling file cache (stable media id, no redownload of valid hits, evict oldest, local `file://` URI).
- Signed URL prep must not replace a local cache hit.
- `file://` is a playable Watch src.
- Fold6 list-height change re-snaps to the current index (no reset to item 1).
- Android preview logs: `WATCH_BIND` / `WATCH_CACHE` (ids only, no URLs).
- Part1F in-place share unchanged.

## Tests already run

84 focused PASS. `tsc --noEmit` PASS.

## Owner QA when new APK is on Fold6

1. Cold/open Watch. First video should become usable without a long network wait if it was cached.
2. Swipe 1→2: item 2 picture + item 2 audio immediately. No black TextureView.
3. Swipe 2→3: item 3 picture + item 3 audio. Not item 2 again. No snap back to 1.
4. Share Cancel / Back still dismiss in place.
5. Optional: airplane mode after 5 cached items — those 5 stay playable.

## Do not

- Production / Play / deploy / production DB
- Fake feed data
- Blind delays / reset-to-item-1 workaround
- Second independent cache system
- Another EAS if `91e8f585` finishes successfully
