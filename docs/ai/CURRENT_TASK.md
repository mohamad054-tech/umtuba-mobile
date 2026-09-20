# Current Task

## Task title

FEAT_BUILD_23_POSTHOG_AND_AUDIO_HANDOFF_V1

## Status

COMPLETE on source. Branch `feat/build-23` from `aa57b8ae`. Not EAS-built. Not submitted to Play. `master` not pushed.

```
TASK_ID = FEAT_BUILD_23_POSTHOG_AND_AUDIO_HANDOFF_V1
STATUS = COMPLETE
DATE = 2026-09-20
BRANCH = feat/build-23
WORKTREE = C:\Users\1\Desktop\umtuba\worktrees\FEAT-BUILD-23
BASE = aa57b8aede67b753a95b3f359800cc0df88f147d
VERSION_NAME = 1.0.23
VERSION_CODE_LOCAL = 22
EAS_REMOTE = 22 → autoIncrement produces 23
MIN_SDK = 24 (unchanged)
DEPLOY = FORBIDDEN
EAS_BUILD = FORBIDDEN
PLAY_SUBMIT = FORBIDDEN
PUSH_MASTER = FORBIDDEN
```

## Allowed scope

- New branch from `aa57b8ae` only.
- PostHog EU analytics via `posthog-react-native` and `EXPO_PUBLIC_*` literals.
- Port audio-bleed fix onto the clean-room Watch engine (no force-merge of e0ad65e / 3c092f8).
- Check / fix `WATCH_BACK_DOUBLE_PRESS` if genuinely broken.
- versionName 1.0.23. Keep minSdk 24.
- Typecheck, tests, local Expo config check.
- Push `feat/build-23` only.

## Forbidden scope

- Do not run `eas build`.
- Do not submit to Google Play.
- Do not push `master`.
- Do not apply SQL / `supabase db push`.
- Do not add extra advertising / ATT / session-replay SDKs.
