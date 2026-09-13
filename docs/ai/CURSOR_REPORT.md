# CURSOR_REPORT — DESKTOP_ANDROID_POST_PUBLISH_EDITING_V1

## Summary

Owner post + video edit is ported to an isolated Android worktree from the phone SHA `da449c9` (Watch V3 / `1a4b0f8` lineage). Owners get a visible Edit control on the Watch rail and on own Profile video cards. Save updates the same Post ID under RLS. Cancel or failed save does not switch live media. Watch playback now reads published web `media_pipeline.playback.inMs/outMs`, so a computer trim is visible after pull-to-refresh or reopen. Watch V3 cache/window code was not rewritten. Local tests for the new modules passed. Fold6 was attached (versionCode 20). A new versionCode 22 APK was prepared in source; install was not completed in this session because the EAS CLI hung and no JDK was on PATH.

## Exact files changed

- `app.config.ts` — versionCode 22
- `eas.json` — `appVersionSource: local` so preview APK uses 22
- `app/edit/post.tsx` — owner edit screen
- `app/_layout.tsx` — edit route
- `app/(tabs)/watch.tsx` — Edit entry + post-edit snapshot patch
- `app/profile/index.tsx` — own-video Edit
- `components/WatchVideoCard.tsx` — Edit rail + edited indicator
- `components/profile/ProfileTimeline.tsx` — Edit affordance
- `src/lib/media/videoTrim.ts` + test
- `src/lib/social/editOwnedPost.ts` + test
- `src/lib/social/ownedPostEditSignal.ts` + test
- `src/lib/social/uploadPostImage.ts`
- `src/lib/video/videoEditState.ts` + tests — read/write `playback.inMs/outMs`
- `src/lib/video/watchEditPlayback.test.ts` — web IN/OUT contract
- `src/lib/feed/watchFeed.ts` — `fetchWatchVideoSnapshot`
- `src/lib/watch/railLayout.ts` + test
- `src/lib/i18n/messages/*` — edit strings
- `docs/ai/CURRENT_TASK.md`, this report, `docs/ops/android-post-publish-editing-v1/`

## Migrations created

None.

## Security review

- Owner filter is UUID match + `posts.update` / `articles.update` with `.eq("user_id", userId)`.
- Non-owner load returns null; update is not called.
- Patch refuses `id`, `user_id`, `created_at`, and engagement counters.
- Unvalidated video replace aborts and leaves `video_path` unchanged. Failed switch deletes the candidate object only.
- Image upload goes to `post-images/{userId}/…`. Video replace reuses existing owned `post-videos` upload.
- No service-role key. No RLS bypass.

## Tests

- `vitest` focused: `videoTrim`, `editOwnedPost`, `ownedPostEditSignal`, `watchEditPlayback`, `videoEditState`, `railLayout`, `i18n` — **36 passed** after localizing IN/OUT labels.
- Device QA — **NOT_RUN** (no new APK installed).

## TypeScript

- `tsc --noEmit` reported 3 errors: pre-existing Watch V3 handoff typing at `watch.tsx:905`, and missing `expo-sharing` types (junction/`da449c9` baseline). No new errors in edit modules. Watch cache/window code was not “fixed” in this GO.

## Build

- Source versionCode **22**. EAS preview start hung on `npx eas-cli` with no build id. No Play upload.

## git diff --check

Clean (no whitespace errors reported).

## git status --short

Dirty isolated worktree only (edit port + docs). Parent `umtuba-mobile` and Watch V3 worktree were not reset. `node_modules` is a junction to the Watch V3 install (gitignored).

## Open issues

- APK not installed; Fold6 still on versionCode **20** / Watch V3 preview `6bc060ed`.
- Watch honors IN/OUT after refresh/reopen, not realtime.
- Nested Profile Edit is a second entry; primary is Watch rail.
