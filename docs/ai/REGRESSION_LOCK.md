# UMTUBA Regression-Lock System

Machine-readable registries live in `config/regression-lock/`.

| Command | Purpose |
|---|---|
| `npm run regression:task-check` | Valid manifest required before product edits |
| `npm run regression:baseline-check` | Compare task scope to locked baselines |
| `npm run regression:scope-check` | Classify `BASE_SHA..HEAD` + working tree |
| `npm run regression:contracts` | Expand dependent tests from the file graph and run them |
| `npm run regression:pre-eas` | Block EAS unless every gate is green |
| `npm run regression:snapshot` | Before/after drift report |
| `npm run regression:device-required` | Print contracts that cannot become OWNER_PASS from unit tests |
| `npm run regression:build-lock` | Record the single authorized EAS id |

Set `UMTUBA_TASK_MANIFEST` to override the manifest path.

Pre-EAS also requires:

```
UMTUBA_TYPECHECK_PASS=1
UMTUBA_LOCAL_BUNDLE_PASS=1
```

Default EAS budget is 1. This tooling does not call EAS.

`src/lib/regressionLock/**` is excluded from the app `tsc` project (Node CLI tooling). Guard coverage is `npm run test -- src/lib/regressionLock`.

OWNER_PASS freeze updates `UMTUBA_BASELINES.json` only after owner device evidence is recorded. Locked contracts cannot be silently superseded.

Current Fold6 Watch known-good is clean-room engine `aa57b8ae` / EAS `62bafb12` (`CLEAN_ROOM_ENGINE_OWNER_PASS_LOCKED`). Historical Phase 1 ~20% swipe remains locked at `f1e85475` / `40b685de`.
