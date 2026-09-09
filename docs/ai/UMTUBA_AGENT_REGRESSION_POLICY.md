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
15. Watch Phase 1 ~20% short swipe is Fold6 `OWNER_PASS` locked at `f1e85475` / EAS `40b685de` (HISTORICAL). Do not modify, weaken, or silently refactor that gesture.
16. Current Fold6 Watch known-good is the clean-room engine `OWNER_PASS` locked at `aa57b8ae` / EAS `62bafb12`. Do not modify, weaken, or silently refactor that engine without a new task manifest and explicit OWNER GO. Phase 1 and clean-room locks are both kept; do not overwrite one with the other.

## Required sequence

`OWNER_PASS` → baseline lock → regression contract → change-scope check → test gates → device gate when required → only then next work.

## Current Fold6 Watch

```
WATCH_CLEAN_ROOM_ENGINE = OWNER_PASS LOCKED (CURRENT Fold6 known-good)
AUTHORITATIVE_SOURCE = aa57b8aede67b753a95b3f359800cc0df88f147d
AUTHORITATIVE_EAS = 62bafb12-d89f-4e30-8842-28b391cb3c8d
FREEZE_BRANCH = desktop/watch-owner-pass-aa57b8ae
FREEZE_TAG = watch-fold6-owner-pass-aa57b8ae
DEVICE = RFCX718LVHK / SM-F956B
INSTALLED = aa57b8ae / 62bafb12
LAST_UPDATE_TIME = 2026-09-09 13:07:46
MEASURED_T0_TO_T1_MS = 49
OWNER_CONFIRMED = كلشي تمام
SAFE_ROLLBACK_POINT = aa57b8ae / EAS 62bafb12

WATCH_PHASE1_20_PERCENT = OWNER_PASS LOCKED (HISTORICAL)
AUTHORITATIVE_SOURCE = f1e85475b5ab19b09884f70bc370ff77afe43905
AUTHORITATIVE_EAS = 40b685de-2efc-4fd5-b8e1-31cacd8e8397
DEVICE = RFCX718LVHK / SM-F956B
INSTALLED_HISTORICAL = f1e85475 / 40b685de
WITHDRAWN: 80% commit, finger-down 80%, 5a30e5b0, f7d36b6d, ab9d34d
UM Streak live camera + retention remains OWNER_PASS at 11c0719 / e6ece863.
```

Current known-good (aa57b8ae / 62bafb12): black screen fixed, TextureView, contentFit contain / no horizontal crop, readiness ready-to-render, play/pause, progress + scrub, swipe threshold 10%, snap 120ms, correct binding / no snapback, optimistic Publish, local video visible almost immediately (T0→T1 = 49ms), background upload, same-item reconciliation, no duplicate, no black frame on handoff, position preserved.

Phase 2/3 and any future Watch work must compare against `aa57b8ae` as the current Fold6 Watch baseline. The Phase 1 ~20% swipe lock at `f1e85475` / `40b685de` remains historical and must not be overwritten. Owner GO 2026-09-09: the clean-room engine commit fraction is 10% (`WATCH_ENGINE_COMMIT_FRACTION = 0.1`). Flick velocity stays unchanged. New Watch features need a new task manifest.
