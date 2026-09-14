# CURSOR_REPORT — UMTUBA_REMOVE_SIGNUP_INVITE_CODE_V1

## Summary

Signup invite field removed in source on isolated branch `pc2/remove-signup-invite-code-v1` commit `c714dd2`. Owner still sees رقم الدعوة because Fold6 is not connected and the installed APK (`59c6652e`) was not replaced. No EAS. No adb. No push.

## Exact files changed

Committed in `c714dd2`:

- `app/(auth)/signup.tsx`
- `src/lib/auth/signupForm.ts`
- `src/lib/auth/signupReferral.contract.test.ts`
- `docs/ai/CURRENT_TASK.md`

## Migrations created

None.

## Security review

No secrets. No hosted DB. No uninstall / data reset.

## Tests

`npx vitest run src/lib/auth/signupReferral.contract.test.ts src/lib/auth/claimReferralRpc.test.ts` — 3 passed.

## TypeScript

`npx tsc --noEmit` — PASS.

## Build

Not run. EAS not started (device not connected).

## git diff --check

PASS on the commit.

## git status --short

`docs/ai/CURSOR_REPORT.md` dirty (this report). Commit `c714dd2` is local-only.

## Open issues

1. Installed Fold6 APK still has the field.
2. Next GO when Fold6 is plugged in: one EAS preview + `adb install -r`.
