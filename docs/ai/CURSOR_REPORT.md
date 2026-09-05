# CURSOR_REPORT — PC2_UMTUBA_FOLD6_MESSENGER_REALTIME_CRASH_AUTO_FIX_V1

```text
TASK_ID = PC2_UMTUBA_FOLD6_MESSENGER_REALTIME_CRASH_AUTO_FIX_V1
STATUS = READY_FOR_OWNER_RETEST
DEVICE = RFCX718LVHK
OLD_BUILD = 52e38325-045a-4d8c-9fa5-8c0b28b899a0
NEW_BUILD = 59c6652e-3557-4b27-b057-21c36810c356
REALTIME_ERROR_REPRODUCED = YES_FROM_OWNER_AND_PRIOR_LOGCAT
ROOT_CAUSE = REUSED_SUBSCRIBED_CHANNEL
FILES_CHANGED = src/lib/messenger/realtime.ts, src/lib/messenger/realtime.test.ts, src/lib/messenger/api.ts, app/messages/[id].tsx, docs/ai/CURRENT_TASK.md, docs/ai/CURSOR_REPORT.md
FIX = Fresh unsubscribed channel; all postgres_changes before subscribe; inbox only when requested; remount evicts instead of mutating a joined topic
HANDLERS_BEFORE_SUBSCRIBE = YES
DUPLICATE_CHANNEL_PROTECTED = YES
CLEANUP_VERIFIED = YES
MESSENGER_REALTIME = FUNCTIONAL_ON_DEVICE
UM_STREAK_REALTIME = MESSAGE_INSERT_REFRESH_PLUS_SEPARATE_TOPIC
VISUAL_UPLOAD_REGRESSION = PASS_TESTS
TESTS = PASS (33)
TYPECHECK = PASS
EAS_BUILD_ID = 59c6652e-3557-4b27-b057-21c36810c356
ADB_INSTALL = SUCCESS_REPLACE
APP_LAUNCH = YES
COMMUNICATIONS_OPEN = YES
CONVERSATION_OPEN = YES
REALTIME_CRASH_AFTER_FIX = NO
UM_STREAK_ENTRY = YES
STORAGE_UPLOAD = PRESERVED_NOT_OWNER_VISUAL
BACKEND_CHANGED = NO
PRODUCTION_DB_CHANGED = NO
PUSHED = NO
PLAY_TOUCHED = NO
READY_FOR_OWNER_RETEST = YES
```

## Summary

Owner Fold6 error `cannot add postgres_changes callbacks for realtime:messenger:<conversation_uuid> after subscribe()` was a reused subscribed Realtime channel.

`supabase.channel(name)` returns the existing topic. The Messages tab keeps `messenger-inbox:<userId>` subscribed. Opening a 1:1 called `subscribeMessengerRealtime`, which subscribed `messenger:<conversationId>` then tried `.on('postgres_changes')` on the already-subscribed inbox topic. That throw leaked the thread channel because cleanup never returned. Reopening the same conversation then threw the owner topic `realtime:messenger:<uuid>`. Thread effect deps also included `peerLastReadAt`, so peer polling remounted the subscription against a still-subscribed channel (`removeChannel` is async).

Minimum fix: create a fresh unsubscribed channel, attach every `postgres_changes` handler, then `subscribe()`. Evict same-name leftovers; if the topic is still joined, use a generation suffix instead of mutating it. Thread no longer attaches inbox handlers. UM Streak still refreshes from message insert and must use `um-streak:<conversationId>` if it ever needs its own stream. `src/lib/umStreak/upload.ts` ArrayBuffer path was not touched.

One Android preview EAS `59c6652e` from commit `6235da6` was installed with `adb install -r`. Automation launched the app, opened Messages, opened the مارينا بوست 1:1, opened UM Streak camera, and returned to the thread. No error-boundary UI and no `postgres_changes after subscribe()` in logcat. Do not claim owner visual upload PASS.

## Exact files changed

- `src/lib/messenger/realtime.ts`
- `src/lib/messenger/realtime.test.ts`
- `src/lib/messenger/api.ts`
- `app/messages/[id].tsx`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

Local evidence only, do not commit: `docs/ai/pc2-fold6-realtime-crash-autofix/`.

## Migrations created

None.

## Security review

- No auth weakening. Same RLS-filtered `messages` / `conversation_participants` topics.
- No backend schema change. No secrets printed.
- Realtime remains enabled; the exception is not swallowed.
- Replace-install only. App data was not reset or uninstalled.

## Tests

`npx vitest run src/lib/messenger/realtime.test.ts src/lib/umStreak` — 7 files, 33 passed.

Proved handlers-before-subscribe, remount does not attach to a subscribed channel, cleanup removes channels, inbox+thread coexist, UM Streak stays off the messenger topic, previous visual upload tests remain PASS.

## TypeScript

`npx tsc --noEmit` — pass.

## Build

One Android preview EAS: `59c6652e-3557-4b27-b057-21c36810c356` from `6235da6`. Finished. APK installed with `adb -s RFCX718LVHK install -r`.

## git diff --check

Pass on changed source files.

## git status --short

Fix committed on `pc2/fold6-messenger-realtime-crash-auto-fix-v1`. Evidence folders remain untracked. Not pushed.

## Open issues

- Owner should visually confirm the same 1:1 opens, Realtime stays quiet, UM Streak camera/send still works.
- Automation does not claim human-eye upload PASS.
