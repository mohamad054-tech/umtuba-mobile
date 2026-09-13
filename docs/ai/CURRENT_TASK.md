# Current Task

## Task title

DESKTOP_ANDROID_USER_REPORTED_DEFECT_REPRO_V1 — SUPERSEDED

## Status

Stopped immediately. Central issued a new GO: Android v11 surgical Fold6 QA from SHA `7b33bae`. Fold6 is required for that install. Do **not** continue this v10 repro.

```
TASK_ID = DESKTOP_ANDROID_USER_REPORTED_DEFECT_REPRO_V1
STATUS = SUPERSEDED
INSTALLED_VERSION_CODE = 10
INSTALLED_SOURCE_SHA_IF_KNOWN = 9e04a97ca4f8e7e8e0d6135d41c9deb8aa315d8d
SOURCE_CHANGED = NO
FIX_IMPLEMENTED = NO
PLAY_UPLOAD = NO
PRODUCTION_SUBMISSION = NO
DEVICE_LEFT_AS_IS = YES
```

Partial evidence: `docs/ops/android-v10-user-reported-defect-repro/`

## Allowed / Forbidden

Do not continue v10 repro. Do not rebuild. Do not modify source. Do not upload Play. Do not uninstall the Fold6 package unless the v11 GO requires a replacement install.
