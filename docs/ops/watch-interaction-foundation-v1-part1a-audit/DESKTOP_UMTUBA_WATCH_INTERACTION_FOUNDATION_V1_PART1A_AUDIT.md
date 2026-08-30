# DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1A_AUDIT

Audit-only. No implementation. No deploy. No Play/App Store upload. No migrations.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1A_AUDIT
STATUS = AUDIT_COMPLETE
AUTHORITATIVE_SOURCE = C:\Users\1\Desktop\umtuba\worktrees\DESKTOP-ANDROID-FOLD6-WATCH-VIDEO-FIT-V1
SOURCE_SHA = 703740b85048d4d14ea6ffb1e322f33b33d24a48
CENTRAL_ORIGIN_MASTER = 09e94f80775855d7e2036fa7d83d63b9202fb8a4
FIT_AHEAD_OF_ORIGIN_MASTER = YES
FIT_ON_ORIGIN = NO
DIRTY_MOBILE_PARENT = C:\Users\1\Desktop\umtuba\umtuba-mobile @ 3b335610ced48aa2595fe49eef5b97511c7f4cb5 (STALE_FOR_WATCH; DO_NOT_USE)
IMPLEMENTED = NO
DEPLOYED = NO
PLAY_UPLOAD = NO
APP_STORE_UPLOAD = NO
READY_FOR_PART1B_IMPLEMENTATION = YES
```

## Authoritative source decision

Inspected live trees on 2026-08-30. Did not treat older Fold6 QA packets as current Watch source.

| Tree | HEAD | Watch currency |
| --- | --- | --- |
| FIT worktree `desktop/android-fold6-watch-video-fit-v1` | `703740b` | **Authoritative current Watch.** Owner-confirmed Fold6 1.0.22 install. Contains `origin/master` + 3-video prepare window + contain/FIT. |
| `origin/master` | `09e94f8` | Central shared mobile tip. Ancestor of `703740b`. Missing FIT + V3 cache commits. |
| Next-video worktree | `da449c9` | Older V3 QA line. Superseded by FIT. |
| Android post-edit worktree | `da449c9` + dirty edit | Not installed. Out of this audit. |
| Dirty `umtuba-mobile` parent | `3b33561` + UGC dirt | Stale Watch. Do not patch. |

Central remains authority for shared mobile. Part 1B must be an isolated worktree from `703740b`, not the dirty parent.

## Watch implementation paths

- `app/(tabs)/watch.tsx`
- `components/WatchVideoCard.tsx`
- `components/WatchSideVolumeControl.tsx`
- `components/CommentsSheet.tsx`
- `src/lib/watch/playbackPolicy.ts`
- `src/lib/watch/playerLifecycle.ts`
- `src/lib/watch/playerSession.ts`
- `src/lib/watch/activePlayerOwnership.ts`
- `src/lib/watch/androidWatchMediaCache.ts`
- `src/lib/watch/watchVideoFit.ts`
- `src/lib/watch/railLayout.ts`
- `src/lib/watch/watchHeaderOverlay.ts`
- `src/lib/feed/watchFeed.ts`
- `src/lib/feed/watchPlaybackPrep.ts`
- `src/lib/feed/signedUrlScheduler.ts`
- `src/lib/social/interactions.ts`
- `src/lib/social/follows.ts`
- `src/lib/social/comments.ts`
- `src/lib/social/shareEntry.ts`
- `src/lib/social/sharePost.ts`
- `src/lib/nav/profileBackContext.ts`
- `src/lib/nav/watchRootExit.ts`
- `app/sound/[id].tsx`

No `react-native-gesture-handler` or `expo-haptics` imports in app source. Watch gestures are RN `Pressable` + paging `FlatList`.

---

## GAP_MATRIX

| feature | class | evidence | required delta |
| --- | --- | --- | --- |
| 1. Swipe up = next video | EXISTS | Vertical paging `FlatList` (`pagingEnabled`, `snapToInterval=itemHeight`, viewability 80%/80ms) in `watch.tsx`. Owner FIT QA: SWIPE PASS. | Preserve. Do not replace with a new pan recognizer in P0. |
| 2. Swipe down = previous video | PARTIAL | Same paging list goes backward. `RefreshControl` is also attached, so downward overscroll can refresh instead of previous, especially near index 0. | Gate refresh so it cannot steal previous-video swipe. Keep paging. |
| 3. Double tap video = Like | MISSING | `tapLayer` `onPress={onTogglePlayPause}` only. No `numberOfTaps`, no double-tap handler, no Gesture.Tap. | Add video-area tap classifier. Double tap calls like-only, never toggle-unlike. |
| 4. Double-tap Like visual feedback | MISSING | Play/pause badge exists (`feedbackBadge`). No like burst / heart overlay on video. Rail heart updates only after RPC. | UMTUBA-owned brief like confirmation on the video (not a TikTok clone). |
| 5. Double-tap haptic feedback | MISSING | `expo-haptics` not in `package.json`. No haptic calls in Watch. | P1: add haptic dep + light impact on successful like only. |
| 6. Single tap video behavior | EXISTS | Full-bleed `tapLayer` (minus 68px volume gutter) toggles play/pause. | Keep. Must share a delay/classifier with future double-tap. |
| 7. Play/pause behavior | EXISTS | `onTogglePlayPause` + `shouldPlayWithUserPause`. Inactive cards ignore user pause so the next card autoplays. Badge ~play/pause. | Preserve. Classify vs double-tap so one tap still pauses. |
| 8. Long press video | MISSING | No `onLongPress` / `delayLongPress` on the video layer. | P1 only. Must not fight scrub or swipe. |
| 9. Quick-action menu | MISSING | No long-press sheet. Rail has discrete Like/Save/Comments/Share/Report/Block/Delete. | P1: UMTUBA sheet, not a cloned menu. |
| 10. Not Interested | MISSING | Report can hide a post locally (`setHiddenPostIds`). No named Not Interested action. | P1/P2 product name on UMTUBA terms. Do not invent backend hide taxonomy in P0. |
| 11. Save/Favorite | EXISTS | Rail star → `togglePostSave` via `post_saves` RLS. | Preserve. Add in-flight lock + optional optimistic in P1. |
| 12. Follow directly from Watch | MISSING | Follow RPCs live in `src/lib/social/follows.ts` and Profile chrome. Watch card has username → Profile only. No Follow control on Watch. | P1/P2 rail Follow. Do not reuse Profile toggle blindly (web rule: Following, never Unfollow). |
| 13. Comments without losing Watch position | EXISTS | `CommentsSheet` is a `Modal` on the same Watch screen. `commentPostId` only. Back/header close nested overlay first. `activeIndex` unchanged. | Preserve overlay. Do not route to a comments screen. |
| 14. Share without losing Watch position | EXISTS | `Alert.alert` share chooser on the same screen. Link/file share. | Preserve in-place share. |
| 15. Profile open + return to exact Watch position | PARTIAL | `router.push` + `rememberProfileBackContext` + `registerMountedWatchInstance` (7e5f734/17cbfef class). Blur pauses via `shouldPlayVideo(screenFocused=false)` and `bumpWatchLeaveGeneration`. Player teardown uses `resetPosition: false`. Exact clock resume is intended, not a stored Watch-position object. Nested follow-list was historically fragile; surgical nav now exists. | P0: do not rewrite nav. Verify return does not remount player / reset index. Do not open Profile in a way that remounts `/(tabs)/watch`. |
| 16. Sound page entry | PARTIAL | Sound chip `router.push(/sound/[id])` when `edit.soundId` exists. Sound page can then push Create. No Watch-origin remember on that push. | P1: return to the same Watch item. Do not treat as P0 unless it remounts Watch. |
| 17. Hashtag entry | MISSING | Caption is plain `Text` `numberOfLines={3}`. Discover hashtags are “coming soon”. | P2. Out of P0. |
| 18. Mention entry | MISSING | Caption not parsed. Mention exists only as a notification type. | P2. Out of P0. |
| 19. Caption expand/collapse | MISSING | Hard clamp `numberOfLines={3}`. No toggle. | P2. |
| 20. Playback speed | MISSING | No `playbackRate` / speed UI in `src/lib/watch`. | P1 after gesture lock is stable. |
| 21. Progress indicator | EXISTS | Clock + scrub track in overlay (not under VideoView). RTL fill forced LTR (`WATCH_SCRUB_LAYOUT_DIRECTION`). | Preserve. Optional: hide on very short clips in P1. |
| 22. Scrubbing for eligible longer videos | PARTIAL | Scrub exists for any `duration > 0` (`canSeekWithDuration`). No long-video eligibility gate. Scrub disables list scroll. | P1: gate or de-emphasize scrub on short clips so it cannot steal swipe. |
| 23. Resume after temporary interruption | EXISTS | `shouldPlayVideo` requires `appState === "active"` + focused. Inactive teardown keeps position. | Preserve. |
| 24. Pause when app backgrounds | EXISTS | `AppState` → `shouldPlayVideo` false. `staysActiveInBackground = false`. | Preserve. |
| 25. Correct resume when app foregrounds | EXISTS | Foreground + focused + not `userPaused` resumes the active owner only. Tests in `playerLifecycle` / `activePlayerOwnership`. | Preserve. |
| 26. Preserve current video when returning from child surface | PARTIAL | Comments/Share stay on Watch. Profile uses mounted-instance pop. Sound/Create leave Watch without the same origin memory. Leave generation pauses audio on blur. | P0: lock comments/share/profile paths. Do not add new full-screen surfaces. |
| 27. Next-video preload | EXISTS | iOS `shouldLoadPlayer` ±1. Android TextureView active-only + silent ±1 prepare + next-surface warm at 1800ms remaining. Signed-URL window 10 / high 3. | Preserve windows. Do not expand Android TextureView count. |
| 28. Previous/current video retention | EXISTS | `shouldPrepareWatchPlayer` keeps previous+current+next. A→B→C→B remounts only distant posts. | Preserve 3-item window. |
| 29. Loading-state behavior | EXISTS | Feed spinner; per-card `ActivityIndicator`; placeholder when not mounted. | Preserve. |
| 30. Failed-video/retry behavior | EXISTS | Error overlay `pointerEvents="auto"`; tap layer disabled on error (v16 hit-test class). Expired signed URL auto-retries once. | Preserve retry above tap layer. |
| 31. Optimistic Like | MISSING | `onToggleLike` awaits `toggle_post_like` then `patchVideo`. | P1. P0 must still debounce/in-flight lock. |
| 32. Optimistic Follow | MISSING | No Watch Follow. Profile follow waits on RPC. | P1/P2 with Watch Follow. |
| 33. Optimistic Save | MISSING | Same await-then-patch as Like. | P1. |
| 34. Accidental gesture prevention | PARTIAL | Scrub/volume disable list scroll. Viewability + 750ms programmatic lock. Volume gutter excluded from tap. Retry overlay wins hits. No tap delay, no double-tap exclusive, RefreshControl can steal down-swipe. | P0: tap classifier + refresh gate + keep existing locks. |
| 35. Vertical-vs-horizontal gesture conflict | PARTIAL | Horizontal scrub vs vertical feed handled by `onScrubGestureChange`. Vertical volume vs vertical feed handled the same way. No RNGH simultaneous-handler graph. | Keep disable-scroll locks. Do not add a competing pan in P0. |
| 36. RTL behavior | PARTIAL | Locale RTL via `I18nManager`. Watch scrub forced LTR to avoid split fill. Rail is physical `right: 12`. Caption/username have no `localeTextAlign`. | P2 polish. Do not flip scrub math. |
| 37. Accessibility | PARTIAL | Labels on like/save/comments/share/play-pause/mute/seek. Cell `accessibilityRole="text"`. Player `accessibilityElementsHidden`. No double-tap a11y action. | P2: like action + announce. Keep exclusive controls. |
| 38. One-thumb reachability | PARTIAL | Rail 44pt, bottom-right. Mute/auto-next are top chips. 6-action rail can crowd short cells; `watchRailFitsCell` is unused by UI. | P2. Do not move rail in P0. |
| 39. Foldable behavior | PARTIAL | Visual contain/FIT (`watchVideoFit.ts`) owner-confirmed on Fold6. No fold-specific gesture/reach layer. Rail helper unused. | Do not reopen FIT. Interaction QA on folded+unfolded in 1B. |
| 40. iPhone behavior | PARTIAL | Shared JS. iOS ±1 mount, no header zIndex (`watchHeaderOverlay`), iPhone-only (`supportsTablet: false`). No iPhone device pass in this audit. | Same P0 codepath. iOS must keep play/pause + preload contracts. |

---

## DOUBLE_TAP_LIKE_CURRENT

Does not exist.

Current video-area tap is **single-press play/pause** on `tapLayer` (`WatchVideoCard.tsx`). Like exists only as an explicit rail heart that calls **toggle** `togglePostLike`.

| Question | Finding |
| --- | --- |
| Exists now? | NO |
| Conflicts with another gesture? | YES if added naively: current `onPress` is play/pause. Rapid double press today = pause then play (or the reverse), not Like. |
| Triggers exactly once? | N/A (missing). Rail like has **no in-flight lock**; rapid heart taps can fire duplicate RPCs. |
| Works anywhere on safe video area? | N/A. Tap layer is `absoluteFill` minus `WATCH_VOLUME_RIGHT_CLEARANCE` (68). |
| Interactive controls excluded? | YES for current single tap: later overlay siblings (chips, volume, meta, rail, timeline) sit above `tapLayer`. Error retry overlay disables tap layer. |
| Rapid taps → duplicate network? | Rail like: YES possible. Double-tap like: would inherit this if it called `onToggleLike`. |
| Repeated double tap → unlike? | If wired to `onToggleLike` / `toggle_post_like`, **YES**. That RPC toggles. Product rule forbids this. |
| Visual feedback | Play/pause badge only. No like burst. |
| Haptic | None. |
| Accessibility | Play/pause is a button. No double-tap like action. |

Desired rule (not implemented):

- Not liked → double tap → LIKE
- Already liked → double tap → stay LIKED
- Unlike only via explicit rail heart

## DOUBLE_TAP_LIKE_REQUIRED_DELTA

1. New Watch video-area tap classifier (single vs double) on `tapLayer` only.
2. `ensurePostLike` (or equivalent) that likes when unliked and **no-ops when already liked**. Do not call `togglePostLike` from double tap.
3. Per-`postId` in-flight lock so a double tap cannot enqueue two RPCs.
4. Optimistic optional in P1; P0 can wait for RPC if lock + no-op-if-liked are correct.
5. Brief UMTUBA-owned visual confirmation (not a cloned animation).
6. Exclude rail, caption, chips, scrub, volume, header, retry.
7. Keep single-tap play/pause with a short wait so one tap still pauses.
8. Do not add unlike-on-second-double-tap.

## GESTURE_CONFLICTS_FOUND

1. **Single tap play/pause vs future double-tap like** — CONFLICTS_WITH_EXISTING_GESTURE. Must classify, not stack raw `onPress` + `onPress` like.
2. **Pull-to-refresh vs swipe down = previous** — CONFLICTS_WITH_EXISTING_GESTURE near top/index 0.
3. **Horizontal scrub vs vertical paging** — handled (scroll disabled while scrubbing). Keep.
4. **Vertical volume vs vertical paging** — handled (same lock). Keep.
5. **Retry vs play/pause** — fixed class (overlay wins). Keep.
6. No long-press conflict today (long-press missing).
7. No RNGH simultaneous-handler graph. Do not introduce one in P0 unless the classifier cannot be done with Pressable timing.

## PLAYBACK_LIFECYCLE_CURRENT

- Only the active focused foreground card may play (`shouldPlayVideo`).
- Background / inactive / Watch blur → pause. `staysActiveInBackground = false`.
- Leave Watch (Profile etc.) bumps `playbackGeneration` so stale play events cannot revive the previous owner.
- Inactive teardown mutes/pauses **without** seek-to-0 (`resetPosition: false`).
- iOS always mute+pause leftovers (Build 24 audio class). Android does not pause an unready ExoPlayer (`dd86a3e`).
- User pause is card-local and cleared when the card becomes inactive so the next item autoplays.
- Auto-next exists (default on). Android waits for next first frame (max 700ms) before handoff.

## PRELOAD_CURRENT

- **iOS:** mount ±1 (`resolveWatchPlayerLoadWindow = 1`).
- **Android:** TextureView active-only (`load window 0`). Silent prepare previous+current+next. Next TextureView attaches only when READY and remaining ≤ 1800ms (or ended).
- Android `useCaching: true` + bounded Exo buffer (8s forward / max bytes).
- Signed URLs: active first, then next 3 high / window 10, inflight dedupe + cache. Expired URL auto-refresh once per card.
- `FlatList`: `windowSize={5}`, `maxToRenderPerBatch={3}`, `removeClippedSubviews={false}`.
- Neighbor selected-sound players are not mounted.

## WATCH_POSITION_PRESERVATION_CURRENT

| Surface | Position kept? |
| --- | --- |
| Comments Modal | YES — same screen, same `activeIndex`, player stays mounted. Playback typically continues. |
| Share Alert | YES — same screen. |
| Profile | INTENDED YES — mounted Watch instance + origin context; playback pauses; seek not reset. Historical remount/follow-list bugs were surgically fixed on this lineage. Not re-device-tested in this audit. |
| Sound page | WEAK — `router.push` without Watch-origin remember. |
| App background | YES — pause, keep position, resume owner only. |
| Child that remounts `/(tabs)/watch` | Would lose instance. Part 1B must not do this. |

There is no first-class “Watch position” object (index + postId + clock). State lives in `activeIndex` + player currentTime + mounted instance.

## Performance audit (inspect, no redesign)

| Topic | Current |
| --- | --- |
| Next-video transition | Android gated handoff + 750ms viewability lock. iOS immediate scrollToOffset. |
| Preload | Bounded 3-window. Do not widen. |
| Duplicate players | Product contract: one audible. Android one TextureView; iOS ±1 muted neighbors. |
| Rerenders | `extraData` includes index + generation + like/save signature. `WatchVideoCard` is `memo`. `renderItem` closes over many callbacks — acceptable; do not add feed-wide state for double-tap visuals. |
| Repeated API | Like/save have no in-flight lock. Signed URLs are deduped/cached. `prepareWatchPlaybackUrls` re-runs on `activeIndex` / identity; skip patch if src unchanged. |
| Signed URL refresh | Cache + generation guard + one expired auto-retry. |
| Memory cleanup | Leave/unmount silence-then-detach. Prepare window evicts distant indexes. |
| Playback persistence | Preferences: mute/volume/auto-next in AsyncStorage. Clock is in-player, not persisted across process death. |

Do not redesign backend or signed-URL architecture in 1B.

## P0_IMPLEMENTATION_PLAN

Smallest safe Part 1B. Isolated worktree from `703740b`. Shared JS only. No Play/App Store. No Learning/Store/payments/schema.

1. **Vertical navigation stability**
   - Keep paging `FlatList` as swipe up/down.
   - Gate `RefreshControl` so pull-refresh cannot steal swipe-down-to-previous.
   - Keep viewability thresholds, programmatic lock, scrub/volume scroll locks.
2. **Double-tap Like**
   - Video-area classifier on `tapLayer` only.
   - Double tap → `ensurePostLike` (no-op if already liked).
   - In-flight lock per post.
   - Exclude chrome. Keep single-tap play/pause.
   - Minimal UMTUBA like confirmation (no cloned branding).
3. **Watch-position preservation**
   - Keep comments/share as overlays.
   - Do not remount Watch on Profile return.
   - Do not add new full-screen Watch children in P0.
4. **Playback lifecycle**
   - Do not change `shouldPlayVideo`, Android/iOS load windows, or background pause.
5. **Gesture conflict prevention**
   - One classifier. No second pan system. Keep retry overlay above tap.

## P1_IMPLEMENTATION_PLAN

- Long-press quick actions (UMTUBA sheet): Save, Report/Not Interested — delay that cannot fire during swipe/scrub.
- `expo-haptics` on like (and optional save).
- Scrub eligibility for longer videos; keep indicator on shorts.
- Playback speed behind existing chrome, not a new gesture war.
- Optimistic like/save (rollback on failure). Watch Follow if product wants it here.

## P2_IMPLEMENTATION_PLAN

- Caption expand/collapse.
- Tappable hashtag/mention (needs destination; Discover hashtags are not ready).
- Follow on Watch rail (Following label, no Unfollow on the rail).
- A11y double-tap like + RTL caption align.
- Use `watchRailFitsCell` on short/fold cells.
- iPhone + Fold6 interaction QA pass.

## FILES_EXPECTED_TO_CHANGE_IN_PART1B

- `app/(tabs)/watch.tsx` — like-only wiring, refresh gate, no nav rewrite
- `components/WatchVideoCard.tsx` — tap classifier, like confirmation, keep play/pause
- `src/lib/social/interactions.ts` + `interactions.test.ts` — `ensurePostLike` + in-flight
- `src/lib/watch/` new small `watchGestures.ts` + tests (classifier, exclusive zones)
- `src/lib/i18n/messages/*.ts` — like confirmation strings only if needed
- Tests for like-only + no-unlike-on-repeat-double-tap

Do not change Learning, Store, payments, Supabase schema, UM Points, web production, Create/Profile beyond Watch-origin return.

## REGRESSION_RISKS

- Double-tap delay makes play/pause feel broken
- Double tap calls toggle and unlikes
- Duplicate like RPCs
- Swipe stolen by tap/refresh/scrub
- Watch remount / index 0 reset after Profile
- Android second TextureView / spinner
- iOS leftover audio or header zIndex stall
- Retry tap falling through to play/pause
- Signed-URL refresh loop
- RTL scrub split-fill if direction is flipped

## ANDROID_IMPACT

Primary. Current Fold6 install is this SHA / 1.0.22 / `versionCode` 22. Shared Watch JS. Keep Android active-only TextureView + 3-prepare window. No Play upload. `versionCode` must still be reconciled before any Play upload (historical lineage warning stands).

## IOS_IMPACT

Same source. Keep ±1 preload and no header zIndex. Tap delay must work on iPhone. `supportsTablet: false` unchanged. No App Store upload. No iOS-only product fork.

## READY_FOR_PART1B_IMPLEMENTATION

YES — audit is sufficient for a scoped P0 1B GO. Implementation is **not** started. Wait for an explicit Part 1B GO. Use isolated worktree from `703740b`.
