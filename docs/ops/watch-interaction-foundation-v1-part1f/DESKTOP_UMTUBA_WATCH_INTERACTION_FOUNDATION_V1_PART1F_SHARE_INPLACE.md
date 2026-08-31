# DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1F_SHARE_INPLACE

In-Watch share chooser. Isolated from `ed39854`. No deploy. No Play. No migrations. No fake feed data.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1F_SHARE_INPLACE
BASE_SHA = ed39854a989e8c25c59510b8f671a7bd9f03ea36
ALERT_ALERT_REMOVED = YES (chooser only)
INPLACE_SHARE_IMPLEMENTED = YES
```

## What changed

- Watch Share no longer uses `Alert.alert` for the link/file chooser.
- `WatchShareSheet` is a transparent Modal on the same Watch screen (same pattern as comments).
- Cancel, backdrop tap, header Back, and Android hardware Back dismiss the sheet first.
- Dismiss does not replace `/(tabs)/watch` and does not change `activeIndex`.
- Playback policy is unchanged while the sheet is open (`shouldPlayVideo` still uses focus + appState).
- Existing `shareWatchPostLink` / `shareWatchPostFile` still run after a choice.

## Preserved

1B/1C/1D/2x and Part1E sound-origin. Part1E sound QA remains DEVICE_QA_BLOCKED_DATA.

## Checks

- Focused: 77 passed
- `npx tsc --noEmit`: PASS
