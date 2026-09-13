# CURRENT TASK — DESKTOP_ANDROID_POST_PUBLISH_EDITING_V1

## Status

`IMPLEMENTATION_COMPLETE / DEVICE_QA_NOT_RUN`

## Task

Port owner post + video edit (before and after publish) to Android, isolated from Watch V3. Same Post ID, RLS/owner only, cancel/fail leave live post, IN/OUT trim + optional media replace, edited indicator. Watch honors published IN/OUT after refresh. Local Fold6 ADB install. No Play upload. No production web deploy.

## Authoritative source

- Isolated worktree: `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-POST-PUBLISH-EDITING-V1`
- Branch: `desktop/android-post-publish-editing-v1`
- Base (phone / Watch V3): `da449c9e9f3c4c0371ecdd2999220b4f69ae4ec5`
- Web reference (read-only): `C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-UMTUBA-POST-PUBLISH-EDITING-V1` (`ab4a243` + `153f0ef`)

## Allowed scope

- Owner edit entry, edit screen, trim/preview, caption/article/hashtags, media replace, cover, Watch IN/OUT honor of `media_pipeline.playback`
- Isolated worktree above
- Local tests, typecheck, local QA APK, Fold6 ADB install
- `docs/ai/CURSOR_REPORT.md` and this file

## Forbidden scope

- Watch V3 cache/window rewrite
- Web Globe / Learning / Store / payments / branding
- Dirty mobile parent / Watch V3 worktree mutation
- Google Play upload
- Production web deploy
- Windows Desktop writes, `_port_extract`
- RLS bypass
