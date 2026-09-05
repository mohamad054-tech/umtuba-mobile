# Current Task

```text
TASK_ID = PC2_UMTUBA_FOLD6_MESSENGER_REALTIME_CRASH_AUTO_FIX_V1
STATUS = READY_FOR_OWNER_RETEST
WORKTREE = C:\Users\Giga store\Desktop\umtuba\umtuba-mobile-um-streak-integration-v1
BRANCH = pc2/fold6-messenger-realtime-crash-auto-fix-v1
HEAD_SHA = 6235da6faee428f111a583d30fbc56a14400b5de
DEVICE = RFCX718LVHK
ANDROID_PACKAGE = com.umtuba.app
OLD_BUILD = 52e38325-045a-4d8c-9fa5-8c0b28b899a0
NEW_BUILD = 59c6652e-3557-4b27-b057-21c36810c356
SUPABASE_TARGET = https://tgucwnjwoyeqoxqaxmew.supabase.co
OWNER_ERROR = cannot add postgres_changes callbacks for realtime:messenger:<conversation_uuid> after subscribe()
ROOT_CAUSE = REUSED_SUBSCRIBED_CHANNEL
SOURCE_FIX_REQUIRED = YES
BACKEND_FIX_REQUIRED = NO
STORAGE_UPLOAD = PRESERVED_ARRAYBUFFER
MESSAGE_RPC = PRESERVED
REALTIME_CRASH_AFTER_FIX = NO
READY_FOR_OWNER_RETEST = YES
PRODUCTION = STRICTLY_FORBIDDEN
PUSH = NO
DEPLOY = NO
PLAY = NO
```

## Product / goal

Owner Fold6 newly installed UM Streak build still failed opening a 1:1 conversation with Realtime `postgres_changes` after `subscribe()`. Auto-fix without asking the owner to diagnose. Do not regress the RN ArrayBuffer upload path.

## Result

Source fix is installed on RFCX718LVHK via one preview EAS `59c6652e` (`adb install -r`, data preserved). Automation opened Communications and the same 1:1 thread. No `Something went wrong` and no `postgres_changes after subscribe()` in UI or logcat. UM Streak camera opened from the thread. Owner should still confirm visually. Do not claim owner visual upload PASS.

## Forbidden scope

- Push / web deploy / Play / TestFlight
- Unrelated features or production schema
- Multiple EAS builds
- Disable Realtime, swallow the exception, revert upload.ts ArrayBuffer path
- Dumping secrets or `.env` values
