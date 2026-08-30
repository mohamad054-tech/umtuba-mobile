# DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1B_IMPLEMENTATION

Isolated P0 implementation. No deploy. No Play/App Store upload. No migrations.

```
TASK_ID = DESKTOP_UMTUBA_WATCH_INTERACTION_FOUNDATION_V1_PART1B_IMPLEMENTATION
STATUS = IMPLEMENTATION_COMPLETE
BASE_SHA = 703740b85048d4d14ea6ffb1e322f33b33d24a48
RESULT_SHA = UNCOMMITTED
BRANCH = desktop/watch-interaction-foundation-v1-part1b
DOUBLE_TAP_LIKE_IMPLEMENTED = YES
DOUBLE_TAP_ALREADY_LIKED_NOOP = YES
DUPLICATE_LIKE_RPC_PROTECTION = YES
SINGLE_TAP_PLAY_PAUSE_PRESERVED = YES
REFRESH_SWIPE_CONFLICT_FIXED = YES
VERTICAL_PAGING_PRESERVED = YES
COMMENTS_POSITION_PRESERVED = YES
SHARE_POSITION_PRESERVED = YES
PROFILE_RETURN_PRESERVED = YES
PLAYBACK_POLICY_CHANGED = NO
PRELOAD_ARCHITECTURE_CHANGED = NO
ANDROID_TEXTUREVIEW_COUNT_CHANGED = NO
TEST_RESULT = PASS (Watch + new interaction tests). Full suite 843 pass / 3 pre-existing fails (appStoreConfig version, wallet locale) not from this GO.
TYPECHECK_RESULT = PASS
ANDROID_DEVICE_QA = NOT_RUN
IOS_DEVICE_QA = NOT_RUN
IMPLEMENTED = YES
DEPLOYED = NO
PLAY_UPLOAD = NO
APP_STORE_UPLOAD = NO
MIGRATIONS_CREATED = NO
READY_FOR_PART1C_P1_FEATURES = YES
```

## What shipped

- `ensurePostLike` — like-only; local already-liked is a no-op; server like-row is a no-op; never applies unlike; per-postId in-flight share.
- One `WatchTapClassifier` — single tap play/pause after 240ms; double tap likes and cancels pending single.
- Video tap layer only. Error/retry unmounts the tap layer (`shouldMountWatchVideoTapLayer`).
- Brief UMTUBA cyan ring + diamond confirmation (320ms, non-blocking). No haptics (`expo-haptics` still absent).
- `RefreshControl` mounted only at `activeIndex === 0`.
- Comments Modal, Share Alert, Profile push/back unchanged.
- Paging FlatList, player windows, signed-URL prep, retry overlay unchanged.

Trace-only type fix: `resolveWatchHandoffReadiness` now receives `{ nextReady, nextFirstFrame }` from the existing handoff ref. Does not change Android handoff timing or TextureView count.

## Device QA checklist (do not claim PASS until observed)

### Android / Galaxy Z Fold6

- [ ] Unfolded: double tap likes an unliked video
- [ ] Unfolded: double tap on already-liked stays liked (no unlike)
- [ ] Rapid repeated double taps → one like only
- [ ] Single tap play/pause still feels immediate
- [ ] Swipe up = next
- [ ] Swipe down = previous (index > 0; refresh must not steal)
- [ ] Index 0 pull-to-refresh still works if used
- [ ] Scrub does not like
- [ ] Volume slider does not like
- [ ] Comments overlay; Watch index/clock kept
- [ ] Share overlay; Watch kept
- [ ] Profile and Back return to same Watch item
- [ ] Retry overlay; no tap-through play/pause
- [ ] Background / foreground resume
- [ ] Multiple videos; only one audible
- [ ] Folded (if current release setup supports it): same interaction set + contain/FIT still holds

### iOS / iPhone

- [ ] Same interaction cases as above
- [ ] Tap delay does not feel broken
- [ ] Preload remains ±1
- [ ] No leftover audio
- [ ] No navigation regression (comments/share/profile back)

Do not upload a build in this GO.
