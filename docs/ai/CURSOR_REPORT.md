# CURSOR_REPORT — Fold6 Watch proven root-cause fix V3

## Summary

V3 closes the two accepted causes only: `readyToPlay` bypassing the surface/binding gate (black + audio), and TextureView-driven itemHeight/snap desync (swipe 2→3 snaps to video 1). Owner Fold6 QA is still required. Do not claim PASS.

## Tests

`tsc --noEmit` PASS. Watch suite 154 PASS, including the ten required V3 assertions.

## Open issues

- Owner Fold6 QA not done. Do not claim BLACK_VIDEO_FIXED or BINDING_FIXED.
- EAS preview / `adb install -r` follow the source commit in this turn.
- Part1E sound-return still DEVICE_QA_BLOCKED_DATA.
- Foundation V1 not complete.

## Resume

See `docs/ai/CURRENT_TASK.md`.
