# DESKTOP_UMTUBA_WATCH_ANDROID_PLAYBACK_REGRESSION_AFTER_PART1F

Fold6 regression after Part1F preview `fa08ba9d` / `e077eed`. No deploy. No Play. No fake data.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_ANDROID_PLAYBACK_REGRESSION_AFTER_PART1F
INTRODUCED_BY_PART1F = YES
ROOT_CAUSE = Always-mounted RN Modal Dialog beside Android TextureView
```

## Diagnosis

Part1F vs Part1E (`ed39854`) product delta is the share chooser only. The chooser used a standing `Modal` next to the Watch list.

On Android, that Dialog window can detach the active TextureView while the prepared ExoPlayer keeps audio. A layout/focus jump can then report item 1 again.

No Part1F change reset `activeIndex` to 0, disabled preload, or rebound players. Cache/ready-window helpers are unchanged.

## Fix

- Share chooser is a host-window overlay, mounted only while open.
- Cancel / backdrop / Android Back still dismiss in place.
- Link/file actions unchanged.

## Checks

- Focused: 81 passed
- `npx tsc --noEmit`: PASS
