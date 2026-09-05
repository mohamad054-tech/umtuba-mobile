# CURSOR_REPORT — UMTUBA_WATCH_VIDEO_OWNER_PROFILE_NAV_REGRESSION_V1

```text
TASK_ID = UMTUBA_WATCH_VIDEO_OWNER_PROFILE_NAV_REGRESSION_V1
STATUS = SOURCE_FIXED_TESTS_PASS_EAS_BUNDLE_FAILED
DEVICE = RFCX718LVHK
OLD_BUILD = 59c6652e-3557-4b27-b057-21c36810c356
NEW_BUILD = NONE
VIDEO_ID = NOT_CAPTURED_DEVICE_WAS_ON_STREAK_CAMERA
DISPLAYED_AUTHOR_ID = posts.user_id via mapRowToWatchVideo (IMAN on owner video)
DISPLAYED_AUTHOR_NAME = IMAN (owner evidence; card shows video.author.username / author_name)
AUTHENTICATED_USER_ID = signed-in Mohamad session (owner)
WRONG_NAV_TARGET_BEFORE = AUTHENTICATED_USER / /profile with ignored ?u=
ROOT_CAUSE = Profile screen never read ?u=/?id=; always rendered useAuth()
REGRESSION_INTRODUCED_BY = 9202978 honor-/profile?u= never landed on this UM Streak tip (not an ancestor)
FILES_CHANGED = app/profile/index.tsx, app/(tabs)/watch.tsx, components/WatchVideoCard.tsx, components/WatchSideVolumeControl.tsx, src/lib/auth/profile.ts, src/lib/profile/*, src/lib/social/follows.ts, src/lib/watch/playbackPolicy.ts, src/lib/watch/volumeLayout.ts, src/lib/watch/railLayout.ts, docs/ai/CURRENT_TASK.md, docs/ai/CURSOR_REPORT.md
FIX = Restore last accepted author href (?u= + profiles.id), load that profile or fail safely, restore left-side volume, lock scrub direction to ltr
IMAN_NAV_TARGET_AFTER = /profile?u=<iman>&id=<iman_user_id> → resolveProfileTarget other
OWN_PROFILE_CASE = author id matches signed-in user → kind own
OTHER_AUTHOR_CASE = each foreign author keeps own id
AVATAR_CASE = same Pressable / same planWatchAuthorProfileNavigation as name
NAME_CASE = same helper
BACK_TO_WATCH = router.push (not replace)
WATCH_TESTS = PASS
PROFILE_TESTS = PASS
UM_STREAK_REGRESSION = PASS (targeted umStreak + messenger realtime/foundation/upload)
TYPECHECK = PASS
EAS_RUN = FAIL_BUNDLE_JAVASCRIPT
EAS_BUILD_ID = 41945bdb-6108-4ec5-b58d-3e9b544f4a1a
ADB_INSTALL = NO
PRODUCTION_DB_CHANGED = NO
PUSHED = NO
PLAY_TOUCHED = NO
READY_FOR_OWNER_IMAN_PROFILE_RETEST = NO
VOLUME_UI_BEFORE = mute chip only (pre-90e01fd) then later accepted compact left-side control
VOLUME_UI_WRONG_CURRENT = wide horizontal ScrubBar volumeBlock (90e01fd, still on this tip)
LAST_KNOWN_ACCEPTED_VOLUME_UI = WatchSideVolumeControl 3370411
VOLUME_REGRESSION_INTRODUCED_BY = 90e01fd horizontal slider retained; 3370411 never merged onto this tip
VOLUME_FILES_CHANGED = components/WatchSideVolumeControl.tsx, components/WatchVideoCard.tsx, src/lib/watch/volumeLayout.ts, src/lib/watch/railLayout.ts
VOLUME_FIX = Restore compact left-side icon + vertical auto-hide slider
VOLUME_CONTROL_TESTS = PASS (volumeLayout + railLayout + playback volume prefs)
VIDEO_PROGRESS_WRONG_CURRENT = ScrubBar fill/thumb inherit Yoga RTL; fill grows from start edge
LAST_KNOWN_ACCEPTED_VIDEO_PROGRESS = WATCH_SCRUB_LAYOUT_DIRECTION=ltr + shared fill/thumb percents (658936e)
VIDEO_PROGRESS_REGRESSION_INTRODUCED_BY = 658936e LTR lock never on this tip; Arabic Fold6 mirrors inherited direction
VIDEO_PROGRESS_ROOT_CAUSE = RTL layout direction inverted visual fill vs physical-left seek math
VIDEO_PROGRESS_FILES_CHANGED = components/WatchVideoCard.tsx, src/lib/watch/playbackPolicy.ts
VIDEO_PROGRESS_FIX = Force ltr on scrub hit/track; scrubFillWidthPercent + scrubThumbLeftPercent
VIDEO_PROGRESS_TESTS = PASS
SEEK_TEST = PASS (pageX left=0 right=1; seek 0/1 → 0/duration)
RTL_PROGRESS_TEST = PASS (direction locked ltr; fill% equals thumb%)
LTR_PROGRESS_TEST = PASS
BLOCKERS = EAS preview 41945bdb failed Bundle JavaScript; no APK; owner visual IMAN retest blocked
NEXT_ACTION = Read Expo bundle logs; owner GO required before a second preview EAS
```

## Summary

Owner evidence is authoritative: tapping IMAN opened Mohamad. Source substitution is in `app/profile/index.tsx`, which ignored `/profile?u=` and always presented the signed-in session. Watch already displayed IMAN from `posts.author_*` / `user_id` and pushed `?u=`, so the first wrong identity is the Profile consumer, not feed mapping.

This UM Streak tip never contained last-accepted Watch chrome:

- `9202978` honor `/profile?u=` (plus later `id=` / `watchAvatarHref`)
- `3370411` compact left-side volume (replacing `90e01fd` horizontal slider)
- `658936e` LTR scrub lock so Arabic does not reverse media progress

Those commits are not ancestors of `d62b7ad`. UM Streak, messenger realtime, and upload were not modified.

Device Phase 1: RFCX718LVHK had `com.umtuba.app` in the foreground, but the UI dump was UM Streak camera (Arabic), not Watch. IMAN video id was therefore not captured from the feed. Owner evidence plus source trace is the proof; this report does not claim owner PASS.

## Exact files changed

- `app/profile/index.tsx`
- `app/(tabs)/watch.tsx`
- `components/WatchVideoCard.tsx`
- `components/WatchSideVolumeControl.tsx` (restored)
- `src/lib/auth/profile.ts`
- `src/lib/profile/index.ts`
- `src/lib/profile/resolveTarget.ts`
- `src/lib/profile/resolveTarget.test.ts`
- `src/lib/profile/watchAvatarHref.ts`
- `src/lib/profile/watchAvatarHref.test.ts`
- `src/lib/profile/watchProfileNav.ts`
- `src/lib/profile/watchProfileNav.test.ts`
- `src/lib/social/follows.ts`
- `src/lib/social/follows.test.ts`
- `src/lib/watch/playbackPolicy.ts`
- `src/lib/watch/playbackPolicy.test.ts`
- `src/lib/watch/volumeLayout.ts`
- `src/lib/watch/volumeLayout.test.ts`
- `src/lib/watch/railLayout.ts`
- `src/lib/watch/railLayout.test.ts`
- `docs/ai/CURRENT_TASK.md`
- `docs/ai/CURSOR_REPORT.md`

## Migrations created

None.

## Security review

- Other-user profile loads by `profiles.id` then username. Missing author is a no-op, not silent self-profile.
- Own-only shortcuts (Settings / email) stay hidden on other profiles.
- Follow RPCs reuse existing `get_profile_follow_snapshot` / `toggle_profile_follow`.
- No secrets, no production DB, no UM Streak/upload changes.

## Tests

Targeted Watch / Profile / UM Streak: **124 passed**.

Full `npx vitest run`: 463 passed, 2 failed pre-existing and out of scope (`ios/appStoreConfig` camera string required by UM Streak; `wallet/format` Arabic-Indic grouping on this Windows locale).

## TypeScript

`npx tsc --noEmit` PASS after deleting local extract dumps.

## Build

One preview EAS ran and failed: `41945bdb-6108-4ec5-b58d-3e9b544f4a1a` (`Bundle JavaScript`, no archive). Local `expo export` is not conclusive here because this worktree `node_modules` is a junction into `umtuba-mobile` and Metro leaked `umtuba-mobile-um-life-home-entry-v1`. That junction is not uploaded to EAS. No second EAS started.

## git diff --check

Pending at commit time.

## git status --short

Isolated branch `pc2/watch-owner-profile-volume-progress-v1` from `d62b7ad`. Unrelated untracked messenger/EAS artifacts left untouched.

## Open issues

- Owner must tap IMAN on Fold6 after the one preview install. Do not claim owner PASS.
- IMAN `VIDEO_ID` / live user ids were not dumped because Watch was not foreground during Phase 1.
