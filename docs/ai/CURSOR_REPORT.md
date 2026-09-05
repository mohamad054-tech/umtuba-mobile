# CURSOR_REPORT — PC2_UMTUBA_FOLD6_MESSENGER_REALTIME_CRASH_AUTO_FIX_V1

```text
TASK_ID = PC2_UMTUBA_FOLD6_MESSENGER_REALTIME_CRASH_AUTO_FIX_V1
STATUS = SOURCE_FIXED_GATES_PASSED
DEVICE = RFCX718LVHK
OLD_BUILD = 52e38325-045a-4d8c-9fa5-8c0b28b899a0
NEW_BUILD = PENDING_EAS
REALTIME_ERROR_REPRODUCED = YES_FROM_PRIOR_LOGCAT
ROOT_CAUSE = REUSED_SUBSCRIBED_CHANNEL
FILES_CHANGED = src/lib/messenger/realtime.ts, src/lib/messenger/realtime.test.ts, src/lib/messenger/api.ts, app/messages/[id].tsx, docs/ai/CURRENT_TASK.md, docs/ai/CURSOR_REPORT.md
FIX = Fresh channel + all postgres_changes before subscribe; inbox only when requested; remount evicts instead of mutating subscribed topic
HANDLERS_BEFORE_SUBSCRIBE = YES
DUPLICATE_CHANNEL_PROTECTED = YES
CLEANUP_VERIFIED = YES
MESSENGER_REALTIME = SOURCE_PRESERVED
UM_STREAK_REALTIME = SEPARATE_TOPIC_PLUS_MESSAGE_INSERT_REFRESH
VISUAL_UPLOAD_REGRESSION = PASS
TESTS = PASS (33)
TYPECHECK = PASS
EAS_BUILD_ID = PENDING
ADB_INSTALL = PENDING
BACKEND_CHANGED = NO
PRODUCTION_DB_CHANGED = NO
PUSHED = NO
PLAY_TOUCHED = NO
READY_FOR_OWNER_RETEST = NO
```

## Summary

Owner Fold6 error `cannot add postgres_changes callbacks for realtime:messenger:<conversation_uuid> after subscribe()` is a reused subscribed Realtime channel, not an upload/RPC failure.

`supabase.channel(name)` returns the existing topic. Inbox keeps `messenger-inbox:<userId>` subscribed. Opening a 1:1 called `subscribeMessengerRealtime`, which subscribed `messenger:<conversationId>` then tried `.on('postgres_changes')` on the already-subscribed inbox topic. That throw leaked the thread channel (cleanup never returned). Reopening the same conversation then threw the owner topic `realtime:messenger:<uuid>`. Thread effect deps also included `peerLastReadAt`, so peer polling remounted the subscription against a still-subscribed channel (`removeChannel` is async).

Minimum fix: create/configure a fresh unsubscribed channel, attach every `postgres_changes` handler, then `subscribe()`. Evict same-name leftovers; if the topic is still joined, use a generation suffix instead of mutating it. Thread no longer attaches inbox handlers. UM Streak must use `um-streak:<conversationId>`, not the messenger topic. Upload ArrayBuffer path was not touched.

## Exact files changed

- `src/lib/messenger/realtime.ts`
- `src/lib/messenger/realtime.test.ts`
- `src/lib/messenger/api.ts`
- `app/messages/[id].tsx`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

- No auth weakening. Same RLS-filtered `messages` / `conversation_participants` topics.
- No backend schema change. No secrets printed.
- Realtime remains enabled; the exception is not swallowed.

## Tests

`npx vitest run src/lib/messenger/realtime.test.ts src/lib/umStreak` — 7 files, 33 passed.

Proved handlers-before-subscribe, remount does not attach to a subscribed channel, cleanup removes channels, inbox+thread coexist, UM Streak stays off the messenger topic, previous visual upload tests remain PASS.

## TypeScript

`npx tsc --noEmit` — pass.

## Build

Pending one Android preview EAS after commit.

## git diff --check

Pass on changed source files.

## git status --short

Fix commit pending on isolated branch. Evidence folders remain untracked.

## Open issues

- One EAS preview + `adb install -r` + Fold6 conversation open still required before READY_FOR_OWNER_RETEST.
- Do not claim owner visual PASS from automation.
