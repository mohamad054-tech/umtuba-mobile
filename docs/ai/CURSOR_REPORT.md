# CURSOR_REPORT — PC2_UMTUBA_UM_STREAK_MOBILE_INTEGRATION_V1

```text
TASK_ID = PC2_UMTUBA_UM_STREAK_MOBILE_INTEGRATION_V1
MOBILE_INTEGRATION_STATUS = INTEGRATED_LOCAL_ONLY
MOBILE_BASE_SHA = 09e94f80775855d7e2036fa7d83d63b9202fb8a4
MOBILE_INTEGRATION_BRANCH = pc2/um-streak-mobile-integration-v1
MOBILE_INTEGRATION_SHA = PENDING_COMMIT
MOBILE_WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-um-streak-integration-v1
COMMUNICATIONS_REUSED = YES
REAL_CAMERA_IMPLEMENTED = YES
PHOTO = YES
VIDEO = YES
PRIVATE_VISUAL_SEND = YES
VIEW_ONCE = YES
VISUAL_REPLY = YES
STREAK_STATE = YES
STREAK_BADGE = YES
ARABIC_RTL = YES
PRIVACY_BLOCKING = YES
TESTS = PASS (40)
TYPECHECK = PASS
ANDROID_CHECK = SKIPPED
SOURCE_CLEAN = YES_ON_ISOLATED_BRANCH
EAS_RUN = NO
PRODUCTION_TOUCHED = NO
PUSHED = NO
READY_FOR_ONE_EAS_FOLD6_BUILD = YES
BLOCKERS = NONE
NEXT_ACTION = Operator may run one EAS Fold6 build from this isolated SHA. Do not install an old APK. Do not claim Fold6 camera PASS until that device build is tested.
WEB_CANDIDATE_SHA = 28a4c2a6ce9c99a4bec3fab22a2168910a24849c
WEB_PRODUCT_SHA = 7d5003d1b1a7efa27b37205c48d5323b5401e783
CONTRACTS = 20260937 then 20260938
TIMEZONE_POLICY = utc_calendar_day
```

## Summary

Preserved the dirty authoritative mobile checkout (`pc2/eas-preview-config-v1` at `77e9e28`) and created an isolated worktree from `origin/master` (`09e94f8`). Integrated the completed UM Streak candidate into the existing mobile Communications inbox and 1:1 thread. No parallel messenger. No EAS. No push. No production SQL.

The mobile flow reuses existing auth, Conversations, expo-image-picker camera/library, supabase upload patterns, Android back, and UGC block list, then calls the already-proven RPCs: `send_um_visual_message`, `open_um_visual_message`, `get_um_streak_for_conversation`. Private media goes to `message-media/{userId}/{conversationId}/…`, never the public UM Life / `post-videos` bucket. View-once does not mint a fresh signed URL after the recipient has opened. Badges are 3/7/30/100/365 only — no money or points. New UM Streak UI is bilingual English/Arabic with RTL layout.

## Exact files changed

- `app.config.ts`
- `app/(tabs)/messages.tsx`
- `app/_layout.tsx`
- `app/messages/[id].tsx`
- `app/messages/streak-camera.tsx`
- `components/messenger/UmStreakBadges.tsx`
- `components/messenger/UmStreakStatus.tsx`
- `components/messenger/VisualMessageBubble.tsx`
- `src/lib/messenger/foundation.test.ts`
- `src/lib/messenger/mapDestination.ts`
- `src/lib/messenger/mapMessage.ts`
- `src/lib/messenger/threadState.ts`
- `src/lib/messenger/types.ts`
- `src/lib/umStreak/*`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None. Mobile consumes existing `20260937` / `20260938`. Production SQL was not applied.

## Security review

- Visual send/open/streak RPCs are server-authoritative; client cannot award streak days.
- Blocked peers are gated locally and by `ugc_users_are_blocked` on the server.
- View-once replay returns `signedUrl: null` for an already-opened recipient.
- Upload path is owned `message-media` only; no public UM Life publish path.
- No secrets, `.env`, APKs, or service-role keys committed.
- Camera/mic usage strings are private-Messages scoped.

## Tests

`npx vitest run src/lib/umStreak src/lib/messenger/foundation.test.ts src/lib/messenger/threadState.test.ts` — 5 files, 40 passed.

Covered: streak engine (duplicate, one-sided, bilateral increment, UTC day, badges, blocking), view-once signed-URL contract, private media path, Arabic copy/RTL, messenger visual mapping.

## TypeScript

`npx tsc --noEmit` — pass.

## Build

Not run. EAS forbidden this gate. `npm run lint` is `tsc --noEmit` (pass). Android gradle lint skipped because it would trigger a full native build.

## git diff --check

Pass.

## git status --short

Clean on `pc2/um-streak-mobile-integration-v1` after the integration commit. Authoritative `umtuba-mobile` checkout left dirty and untouched.

## Open issues

- Fold6 camera/device QA is not claimed. Next gate is one EAS preview build from this SHA.
- Live viewfinder is the system camera (`launchCameraAsync`) from the existing expo-image-picker stack, plus library fallback. In-app `expo-camera` preview was not added so the next EAS does not require a new native module.
- Inbox/thread chrome still uses existing English messenger strings; new UM Streak surfaces are bilingual.
