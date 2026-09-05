# Current Task

```text
TASK_ID = PC2_UMTUBA_FOLD6_MESSENGER_REALTIME_CRASH_AUTO_FIX_V1
STATUS = SOURCE_FIXED_GATES_PASSED
WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-um-streak-integration-v1
BRANCH = pc2/fold6-messenger-realtime-crash-auto-fix-v1
DEVICE = RFCX718LVHK
ANDROID_PACKAGE = com.umtuba.app
OLD_BUILD = 52e38325-045a-4d8c-9fa5-8c0b28b899a0
NEW_BUILD = PENDING_EAS
SUPABASE_TARGET = https://tgucwnjwoyeqoxqaxmew.supabase.co
OWNER_ERROR = cannot add postgres_changes callbacks for realtime:messenger:<conversation_uuid> after subscribe()
ROOT_CAUSE = REUSED_SUBSCRIBED_CHANNEL
SOURCE_FIX_REQUIRED = YES
BACKEND_FIX_REQUIRED = NO
STORAGE_UPLOAD = PRESERVED_ARRAYBUFFER
MESSAGE_RPC = PRESERVED
PRODUCTION = STRICTLY_FORBIDDEN
PUSH = NO
DEPLOY = NO
PLAY = NO
```

## Product / goal

Owner Fold6 newly installed UM Streak build still fails opening a 1:1 conversation with Realtime `postgres_changes` after `subscribe()`. Auto-fix without asking the owner to diagnose. Do not regress the RN ArrayBuffer upload path.

## Result

Source fix is in. Inbox and thread no longer share a subscribed channel. Thread handlers are attached only on a fresh unsubscribed channel, then `subscribe()`. Cleanup removes the previous channel. UM Streak still refreshes from message insert and must use `um-streak:<id>` if it ever needs its own stream. Owner device retest is next after one EAS preview.

## Forbidden scope

- Push / web deploy / Play / TestFlight
- Unrelated features or production schema
- Multiple EAS builds
- Disable Realtime, swallow the exception, revert upload.ts ArrayBuffer path
- Dumping secrets or `.env` values
