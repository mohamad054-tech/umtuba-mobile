# CURSOR_REPORT — Fold6 Watch cell binding V2

## Summary

`0b7e63c` / EAS `91e8f585` owner Fold6 QA FAIL was not Modal and was not fixed by attaching the next TextureView early. That next-surface attach relayouted Fold6, and the list-height effect snapped back to video 1. Playback also started before the active surface attached.

Source fix `83df875e` binds the active page from scroll offset, attaches only the active TextureView, replaces cell source before play, and strips duplicate post IDs without reordering. Rolling cache target remains 5.

EAS preview `5bec2a1f-93d8-4a93-a70e-ae096aa85414` FINISHED on `83df875e`, APK downloaded, `adb install -r` on RFCX718LVHK, app data preserved, app launched. Owner Fold6 QA is still required. Do not claim PASS.

## Tests

Focused Watch binding + policy + lifecycle + cache tests PASS (79). `tsc --noEmit` PASS.

## Open issues

- Owner Fold6 QA not done. Do not claim BLACK_VIDEO_FIXED or BINDING_FIXED.
- Part1E sound-return still DEVICE_QA_BLOCKED_DATA.
- Foundation V1 not complete.

## Resume

See `docs/ai/CURRENT_TASK.md`.
