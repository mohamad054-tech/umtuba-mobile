# DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1E_CHILD_RETURN_AND_RAIL

Watch Interaction Foundation continuation after Part 1D `PASS_WITH_RESIDUALS`. Isolated branch `desktop/watch-interaction-foundation-v1-part1e` from `ab4bbb3`. `b5cba17` remains an ancestor. No deploy. No Play/App Store. No migrations. No production DB. No fake feed data.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1E_CHILD_RETURN_AND_RAIL
IMPLEMENTATION_STATUS = DONE
PART1E_DEVICE_QA = DEVICE_QA_BLOCKED_DATA
EAS_BUILD_ID = f59ba290-9819-477f-a834-2ca1ed12219b
FOLD6_INSTALL = PASS
WATCH_LAUNCH = PASS
REAL_SOUND_ITEM_AVAILABLE = NO
BASE_SHA = ab4bbb398b23424c1220a9146a11daa6a2dc688d
PART1D_PRODUCT_SHA = b5cba17b7b70e9afb43ee9265defb6f626d15741
```

## What changed

- Watch original-sound chip now opens `/sound/{id}?from=watch` and remembers Watch origin.
- Global Back pops the live Watch instance when it is underneath. Replace `/(tabs)/watch` only when that instance cannot be popped.
- Sound page hardware/header Back uses the same origin policy. "Use this sound" still opens Create with no `from=watch`.
- `watchRailFitsCell` now drives compact rail: 4pt gap and hidden count/text labels only when the cell is too short. 44pt targets stay. Fold6 cover stays full rail. Rail position / FIT unchanged.

## Device QA

Fold6 installed `f59ba290`. Watch launched. Owner inspected multiple feed items: all effectively `@mohamad` / self, none exposed an original-sound chip. Prior Fold6 UI dumps (1B/1C/1D) also contain no `sound.original` string. Chip requires `media_pipeline` `soundId` / `sound_id`. In-repo sound IDs are unit-test fixtures only. No separate development database exists in this worktree. Did not query or mutate production to invent a target. Do not mark sound-return PASS or FAIL.

Compact rail is short-cell only; Fold6 cover stays full rail (expected).

## Preserved

Closed 1B/1C/1D gates and 2x speed were not re-run. Share hang remains a residual. Caption More / mention / hashtag / Follow-other remain 1D residuals.

## Checks

- Focused Watch nav + rail + gesture/caption/lifecycle: 167 passed
- `npx tsc --noEmit`: PASS
- EAS preview: `f59ba290` after env-only Node Happy Eyeballs fix (not a product change)

## Next

`PART1F_WATCH_SHARE_INPLACE` — last Foundation residual that can be exercised on the current own-author feed without fake captions/sounds/other creators. Do not invent hashtag routes or feed rows.
