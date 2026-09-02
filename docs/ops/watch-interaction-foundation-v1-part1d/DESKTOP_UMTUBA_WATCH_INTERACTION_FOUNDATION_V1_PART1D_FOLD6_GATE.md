# DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1D_FOLD6_GATE

Physical Fold6 gate for committed Part 1D (`b5cba17`). No deploy. No Play/App Store. No merge to master. No migrations. No product-code change this close-out.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1D_FOLD6_GATE
STATUS = PASS_WITH_RESIDUALS
BASE_SHA = 9613dec4eb6056e6e3c27413cca7895a3f0f181f
PART1D_PRODUCT_SHA = b5cba17b7b70e9afb43ee9265defb6f626d15741
INSTALLED_HEAD = ab4bbb398b23424c1220a9146a11daa6a2dc688d
BRANCH = desktop/watch-interaction-foundation-v1-part1d
WORKTREE_VERIFIED = YES
DIRTY_PARENT_UNTOUCHED = YES
ANDROID_BUILD = PASS
EAS_PREVIEW = 38e86072-51bf-4450-ac3f-e59e627ce03d
FOLD6_INSTALLED = YES
CAPTION_EXPAND_COLLAPSE = NOT_AVAILABLE_SHORT_CAPTIONS
HASHTAGS = STYLED_TAPPABLE / BLOCKED_EXISTING_ROUTE / NOT_IN_FEED_CAPTIONS
MENTIONS = NOT_IN_FEED_CAPTIONS
WATCH_FOLLOW_OWN_HIDDEN = PASS
WATCH_FOLLOW_OTHER = NOT_AVAILABLE_OWN_AUTHOR_FEED
RTL_POLISH = PASS
ONE_THUMB_POLISH = PASS
LONG_PRESS_REGRESSION = PASS
PLAYBACK_SPEED_UI = PASS
PLAYBACK_SPEED_APPLY = NOT_CONFIRMED
VERTICAL_PAGING_REGRESSION = PASS
SINGLE_TAP_PLAY_PAUSE = PASS
DOUBLE_TAP_REGRESSION = NOT_RECONFIRMED_THIS_SESSION
COMMENTS_RETURN = PASS
SHARE_OPEN = PASS
SHARE_DISMISS = STUCK_ALERT
PROFILE_BACK = NOT_REACHED_SHARE_STUCK
BACKGROUND_FOREGROUND = PASS
DUPLICATE_AUDIO = NO
FOLDED_QA = PASS
UNFOLDED_QA = NOT_TESTED_INNER_DISPLAY_OFF
IOS_DEVICE_QA = NOT_RUN
P0_REGRESSIONS = NONE
WATCH_INTERACTION_FOUNDATION_V1_COMPLETE = NO
DEPLOYED = NO
PLAY_UPLOAD = NO
APP_STORE_UPLOAD = NO
MERGED_TO_MASTER = NO
MIGRATIONS_CREATED = NO
```

## Install

- Device: Galaxy Z Fold6 SM-F956B / `RFCX718LVHK`
- `adb install -r` Success
- EAS preview: `38e86072-51bf-4450-ac3f-e59e627ce03d`
- APK: `docs/ops/watch-interaction-foundation-v1-part1d/umtuba-ab4bbb3-38e86072.apk`
- APK SHA256: `9E7120BE429413CFDD1C286FBAF435C7EEA44ED57B8CE6AEFFD4E937E8FA355B`
- Package: `com.umtuba.app` versionName **1.0.22** versionCode **20**
- lastUpdateTime: 2026-08-31 16:38:11
- gitCommitHash on EAS: `ab4bbb398b23424c1220a9146a11daa6a2dc688d` (docs checkpoint on top of product `b5cba17`)
- Not Play. Not the old 1.0.0 crop APK.

EAS queue needed `NODE_OPTIONS=--dns-result-order=ipv4first`. First attempt failed at GCS upload; retry uploaded 3.3 MB and finished.

## Evidence folder

`docs/ops/watch-interaction-foundation-v1-part1d/fold6-qa/`

Notable shots:

- `02-watch.png` — own giraffe post; caption `UMTUBA`; Delete present; no Follow chip
- `04-swipe.png` / `06-swipe.png` / `08-swipe.png` / `10-swipe.png` — distinct next videos, all `@mohamad`
- `13-longpress.png` / `17-sheet2.png` — quick actions: speed 0.5/1/1.5/2x, Save, Not Interested, Show description, Share; Follow absent on own post; RTL
- `14-speed-2x.png` — single-tap pause after a missed speed-chip tap
- `15-after-captions.png` — playback resumed on the same boat clip
- `21-comments.png` — comments sheet empty-state; same 10:17 clip
- `23-share.png` — Share alert; later shots show it remaining until Home
- `30-foreground.png` — same Watch item after Home (pid `22610` unchanged); Share alert still up

## Residuals (do not claim missing natural scenarios as PASS)

1. **Own-author Watch feed.** Every paged item was `@mohamad` with compact caption `UMTUBA`. No More/Less control. No caption hashtag/mention tokens. No other-user Follow chip. Same class as Part 1C.
2. **Burned-in video text** (`#موال_عتابا`) is pixels, not the P2 caption parser.
3. **Speed apply** UI is present; a 2x chip tap was not confirmed (tap dismissed the sheet).
4. **Share Alert can stick** after Cancel/Back — same 1C residual. Blocked a clean Profile-from-username return this session.
5. **Double-tap like** not visually reconfirmed (heart stayed 0 while overlays were up). 1B evidence stands; this gate does not reopen it.
6. Inner Fold6 panel off. iPhone not run.

## Audio

`dumpsys audio`: one `com.umtuba.app` AudioTrack `started`, one `stopped`, one `idle`. Not two audible streams.

## Foundation V1

Not complete. P2 product is installed and the folded cover gate is usable, but caption expand, mention routing, and Follow-on-other were not naturally available on this feed.
