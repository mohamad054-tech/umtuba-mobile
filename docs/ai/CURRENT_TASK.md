# Current Task

## Task title

DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1C_P1_INTERACTIONS

## Status

**IMPLEMENTATION_COMPLETE. Fold6 QA pending after EAS preview.** Isolated P1 Watch interactions on `desktop/watch-interaction-foundation-v1-part1c` from Part 1B `dd320331`. No deploy. No Play/App Store. No migrations.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1C_P1_INTERACTIONS
STATUS = IMPLEMENTATION_COMPLETE
BASE_SHA = dd32033172684048f2c108a9f4e2eded4fd32292
BRANCH = desktop/watch-interaction-foundation-v1-part1c
IMPLEMENTED = YES
DEPLOYED = NO
PLAY_UPLOAD = NO
APP_STORE_UPLOAD = NO
MERGED_TO_MASTER = NO
MIGRATIONS_CREATED = NO
```

## Allowed scope

P1 Watch interactions only: long-press quick actions, optional official Expo 57 haptics, playback speed, scrub eligibility, optimistic like/save, follow-from-Watch using existing follow RPCs, local Not Interested.

## Forbidden scope

- Do not start Part 1D without a new GO.
- Do not reopen Watch FIT design.
- Do not patch dirty `umtuba-mobile` parent `3b33561`.
- Do not deploy. Do not upload to Play or App Store.
- Do not merge to master. Do not create migrations.
- Do not invent Not Interested backend taxonomy.

## Residual

Fold6 physical QA and EAS preview install still required before READY_FOR_PART1D_P2.
