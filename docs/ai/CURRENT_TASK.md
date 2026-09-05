# Current Task

```text
TASK_ID = PC2_UMTUBA_UM_STREAK_MOBILE_INTEGRATION_V1
STATUS = MOBILE_INTEGRATED_LOCAL_ONLY
MOBILE_INTEGRATION_SHA = ad2d1a279fb083bb632322eea8f69f32ffb31d12
PRODUCTION = STRICTLY_FORBIDDEN
DEVICE = PC2
EAS = FORBIDDEN_THIS_GATE
PUSH = NO
DEPLOY = NO
```

## Allowed scope

- Isolated mobile worktree `C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-um-streak-integration-v1`
- Branch `pc2/um-streak-mobile-integration-v1`
- Integrate completed UM Streak candidate contracts (web SHA `28a4c2a6`) into existing umtuba-mobile Communications
- Consume proven backend `20260937` then `20260938` (utc_calendar_day). Do not apply production SQL.
- Typecheck, targeted tests, static checks. Commit on isolated branch only.

## Forbidden scope

- EAS build / adb install / Play / TestFlight
- Push / deploy / production DB
- Force push / reset / clean unrelated work
- Parallel messaging system
- Mutating the dirty Communications web checkout
- Overwriting web candidate `28a4c2a6`
- Installing an old mobile APK

## Next required gate

One operator EAS Fold6 build from this isolated integration SHA. Do not start that gate here.
