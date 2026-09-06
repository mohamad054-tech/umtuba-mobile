# UMTUBA Agent Regression Policy

This is a product contract. Previous accepted behavior is part of the product.

## Evidence levels

- `SOURCE_PASS` / `AUTOMATED_PASS` — unit/type/bundle only.
- `DEVICE_FAIL` — owner physical device rejected the candidate.
- `OWNER_PASS` — owner physical confirmation only. Never inferred from unit tests.

`source/unit PASS != owner device PASS`.

## Hard rules

1. Previous accepted behavior is part of the product contract.
2. "Not asked about" does not mean safe to break.
3. Unit PASS does not override owner device FAIL.
4. Latest commit is not automatically the best baseline.
5. No wholesale cherry-pick from mixed feature branches.
6. No unrelated cleanup during targeted fixes.
7. No silent redesign.
8. No EAS before `npm run regression:pre-eas`.
9. No PASS claim without an evidence level.
10. Always preserve source before risky integration.
11. When uncertain, compare against the accepted baseline, not the newest code.
12. No product edit without a valid task manifest (`docs/ai/tasks/CURRENT_TASK_MANIFEST.json`).
13. Default `MAX_EAS_BUILDS = 1`. A second build needs a new explicit owner GO.
14. Never force-push, `reset --hard` preserved work, or `git clean` preserved worktrees.
15. Do not mark current Fold6 Watch healthy. It is `DEVICE_FAIL`.

## Required sequence

`OWNER_PASS` → baseline lock → regression contract → change-scope check → test gates → device gate when required → only then next work.

## Current Fold6 Watch (do not paper over)

```
CURRENT_FOLD6_WATCH_STATUS = DEVICE_FAIL
OPEN:
- random black video surface
- missing 80% handoff
- old audio bleeding into next video
7536c11 additionally: video 2 black, 2→3 snapback to video 1
Installed device SHA: 11c0719f70fb014e0c0219a679c5a92a1b1815af
Watch source identity remains 1c56aca. Do not mark Watch healthy.
UM Streak live camera + retention is OWNER_PASS at 11c0719 / e6ece863.
```

Do not fix those failures inside a governance-only task.
