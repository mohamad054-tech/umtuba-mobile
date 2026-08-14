# CURSOR_REPORT — PC2 iOS App Store Execution Preparation V2

```text
TASK_ID = PC2_IOS_BUILD_APP_STORE_EXECUTION_PREPARATION_V2
DEVICE = PC2
DEVICE_ROLE = IOS_APP_STORE_EXECUTION_PRIMARY
CENTRAL_COORDINATOR = SERVER
AUTHORITATIVE_BASE_SHA = db7f927467eb2a5416b612c330bfa8440bcf50f0
COMMIT_SHA = 6fd5852f3461e470deee80cd150d577557c49075
BRANCH = pc2/ios-app-store-execution-prep-v2
IOS_BUILD_CONFIG_READY = YES
EAS_IOS_READY = NO
TESTFLIGHT_SUBMIT = NOT_ATTEMPTED
APP_STORE_UPLOAD = NOT_ATTEMPTED
PUSH = NO
```

## Summary

Closed iOS policy gaps that could be fixed without a new backend: Watch Report/Block UI, device-local hide/block, unused camera/mic removal, Team ID in Expo iOS config, and operator-ready App Store docs. Server-side UGC report remains unbound (20260928 SQL off alpha). Expo/EAS are not logged in on PC2. Do not submit.

## Exact files changed

- `app.config.ts`
- `app/(tabs)/create.tsx`
- `app/(tabs)/watch.tsx`
- `app/_layout.tsx`
- `app/blocked-users.tsx`
- `app/messages/[id].tsx`
- `app/settings.tsx`
- `components/WatchVideoCard.tsx`
- `package.json`
- `package-lock.json`
- `src/lib/ios/appStoreConfig.test.ts`
- `src/lib/permissions/foundation.ts`
- `src/lib/profile/profilePresentation.test.ts`
- `src/lib/settings/supportLinks.ts`
- `src/lib/social/ugcModeration.ts`
- `src/lib/social/ugcModerationShared.ts`
- `src/lib/social/ugcModeration.test.ts`
- `docs/app-store/OPERATOR_PACKET.md`
- `docs/app-store/APP_PRIVACY.md`
- `docs/app-store/REVIEWER_NOTES.md`
- `docs/app-store/SCREENSHOT_MATRIX.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

No secrets printed. Team ID written only in committed Expo iOS config (`ios.appleTeamId`), matching live AASA `M6HDH86Z55.com.umtuba.app`. No new public-doc leak. No competing UGC backend. Local block/hide is device-only. Report fails closed while the 20260928 adapter is unbound. Android `android.permissions` array unchanged. Live remains hidden on iOS.

## Tests

`tsc --noEmit` PASS. Focused shared/iOS vitest 109 PASS. Full suite 385 PASS / 1 FAIL (`src/lib/wallet/format.test.ts` locale grouping — pre-existing Arabic-numeral environment, not this change).

## TypeScript

PASS.

## Build

Config-only. No `eas build`. No Xcode. Expo/EAS not logged in.

## git diff --check

Clean.

## git status --short

See commit on `pc2/ios-app-store-execution-prep-v2`. Not pushed.

## Open issues

- EAS/Expo login missing on PC2
- Server-side UGC report queue unbound
- Reviewer account not created
- Screenshots not captured
- No Central TestFlight or App Store GO
