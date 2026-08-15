# PC2_IOS_BUILD4_SAVE_FAIL_REPORT

```text
PC2 REPORT
SOURCE_DEVICE = PC2
TASK_ID = PC2_IOS_BUILD4_SAVE_FAIL_SOURCE_FIX_V1
DATE = 2026-08-15
MODE = SOURCE_FIX_ONLY
AUTHORIZED_IOS_SOURCE_SHA_BUILD4 = edc898fb5b3549ae31d8b05824d9e9840f825bae
LOCATION_PURPOSE_ANCESTOR = 6733cd5dd2a97e3415dbb1ddb76ab6e4d3811045
REMOTE_REF = origin/pc2/a2-open-watch-published-post-v1
WORKTREE = C:/Users/Giga store/Desktop/umtuba/umtuba-mobile-pc2-a2-open-watch-v1
DIVERGED_CHECKOUT_77e9e28_USED = NO
DIVERGED_CHECKOUT_RESET = NO
CURSOR_REPORT_OVERWRITTEN = NO
STORE_WIP_TOUCHED = NO
BUILD5_BUILT = NO
BUILD4_REUPLOADED = NO
APP_REVIEW_SUBMITTED = NO
DEVICE_PASS_INVENTED = NO
```

## FINAL FIELDS

```text
SAVE_ROOT_CAUSE = toggle_post_save is SECURITY INVOKER; other-user save calls award_um_points_to_user / try_award_activity_score which 20260723 revoked from authenticated; insert rolls back; V5 alert surfaces "Unable to update save."
SAVE_FIX_APPLIED = YES — togglePostSave now writes post_saves via RLS (viewer bookmark row) and reads posts.saves; no longer calls toggle_post_save
SAVE_FIX_COMMIT = (filled after commit)
TESTS = PASS — vitest src/lib/social/interactions.test.ts + watchFeed.map.test.ts + deleteOwnedPost.test.ts (17 passed)
TYPECHECK = PASS — npx tsc --noEmit
BUILD5_REQUIRED = YES — Build 4 binary is edc898f and still calls the broken RPC
BLOCKERS = NEW_IOS_BINARY_REQUIRED_FOR_DEVICE_RETEST; PRODUCTION_RPC_STILL_BROKEN_FOR_OTHER_USER_SAVE_SIDE_EFFECTS
SAVED = FAIL_ON_BUILD4 — source fixed; not retested on device
AUTHENTICATED_SAVE = FAIL_ON_BUILD4 — source fixed; not retested on device
SAVE_PERSISTENCE = BLOCKED_ON_BUILD4 — source path unblocked; needs Build 5
RELEASE_CRITICAL_DEFECT = YES_UNTIL_NEW_BINARY
```

## 1. Device report (do not invent PASS)

Physical iPhone 13 / TestFlight Build 4 / authenticated session.
Attempted to save another user's Watch video using Save/star.
Actual: "Save failed" / "Unable to update save. Please try again."

V5 sweep (`88978a5`) added `Alert.alert("Save failed", result.message)` so a previously silent RPC failure is now visible. The alert is expected while the write path fails. This job found why the write fails.

## 2. Root cause

Client (Build 4 / `edc898f` and tip `6733cd5` before this fix):

- Watch ★ → `onToggleSave` → `togglePostSave(supabase, video.postId)`
- `togglePostSave` called RPC `toggle_post_save` with `{ p_post_id }`
- RPC name and args are correct. `postId` is the Watch `posts.id`. Not a like/bookmark mixup. Own-video rejection is not the client rule.

Production SQL (web migrations, last writer `20260721_activity_tiers_event_wiring.sql`):

1. `toggle_post_save` is `SECURITY INVOKER` (runs as the signed-in user).
2. After inserting `post_saves`, if `v_owner is distinct from v_uid` (another user's video), it `perform`s:
   - `create_notification(...)`
   - `award_um_points_to_user(...)`
   - `try_award_activity_score(...)`
3. `20260723_um_points_award_security.sql` revoked `EXECUTE` on `award_um_points_to_user` from `anon` and `authenticated`. Comment: internal DEFINER-only helper.
4. `try_award_activity_score` also revoked `EXECUTE` from `PUBLIC`.
5. Any of those calls abort the invoker function. The `post_saves` insert is in the same transaction and rolls back.
6. Client maps the non-auth error to `"Unable to update save. Please try again."`

Why this matches the device case:

- User saved **another** user's video → hits the award/notification block.
- Saving **own** video skips that block (`v_owner is not distinct from v_uid`). Own save may still work on the RPC if `um_points_config_value` is executable; not proven on device.
- `toggle_post_like` never gained award side effects (still the 20260713 invoker toggle). Like is a different path.
- Follow uses `toggle_profile_follow` (DEFINER). Unrelated.
- Session is authenticated: guest would have returned `"Please sign in to save posts."` The observed copy is the generic RPC-failure string.

`post_saves` RLS itself allows the viewer to insert/delete their own bookmark row when the post exists. The table path was never the blocker. The RPC side effects were.

## 3. Fix

Smallest safe mobile source change:

- `togglePostSave` uses `auth.getUser()` then insert/delete on `post_saves` (RLS).
- Re-reads `posts.saves` (counter trigger `sync_post_saves_count` still runs).
- Does **not** call `toggle_post_save`.
- Guest still auth-gated.
- Like / share / view RPCs unchanged.
- Open Watch, Messages, login→Profile, Follow/Following, location `6733cd5`, camera/mic removal untouched.

Trade-off (documented, not hidden): creator save notification and UM Points / activity score will not fire until Central converts `toggle_post_save` to a trusted `SECURITY DEFINER` (or stops calling revoked helpers from INVOKER) and applies that migration. Save **persistence** is the release-critical path and now uses the RLS contract that still works on production.

## 4. Exact files changed (mobile)

- `src/lib/social/interactions.ts`
- `src/lib/social/interactions.test.ts` (new)
- `docs/ai/PC2_IOS_BUILD4_SAVE_FAIL_REPORT.md` (this file)

## 5. Tests / typecheck

```text
npx tsc --noEmit
  PASS

npx vitest run src/lib/social/interactions.test.ts src/lib/feed/watchFeed.map.test.ts src/lib/social/deleteOwnedPost.test.ts
  Test Files  3 passed (3)
  Tests  17 passed (17)
```

New coverage:

- Does not call `toggle_post_save`
- Guest auth-gated
- Other-user video inserts `{ user_id: viewer, post_id }`
- Existing bookmark deletes
- Unique-violation insert treated as saved
- Invalid post id rejected
- Like still uses `toggle_post_like`

`git diff --check` clean before commit.

## 6. Git

Worked only on `pc2/a2-open-watch-published-post-v1`.
`6733cd5` remains an ancestor.
Did not reset/merge `77e9e28` at `umtuba-mobile`.
Did not force push.

## 7. What this does not do

- Does not build Build 5
- Does not re-upload Build 4
- Does not submit App Review
- Does not apply a remote SQL migration
- Does not invent iPhone PASS after the source fix
- Does not restore camera/mic
- Does not touch Store WIP

## 8. Central follow-ups

1. Ship a new iOS binary from this commit (Build 5) for iPhone 13 retest of other-user Save.
2. Optional SQL: make `toggle_post_save` `SECURITY DEFINER` with locked `search_path` (same pattern as share/view), or drop award calls from the INVOKER body. Do not apply from this job.
3. Web `lib/supabase/socialInteractions.ts` still calls the broken RPC; out of this mobile scope.
