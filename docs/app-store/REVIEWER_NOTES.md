# App Review notes (operator pastes — do not submit from repo)

## Reviewer-account requirement

**REVIEWER_ACCESS_READY = NO until the owner creates a real email/password account.**

This repo does not invent credentials. Before TestFlight or App Store submit, the owner must:

1. Create a dedicated reviewer account in the same Supabase project as production.
2. Confirm the account can sign in, watch a public video, and (optionally) publish a short clip.
3. Put the email and password only in App Store Connect Review Notes — never commit them here.

Sign in with Apple is not required (email/password only; no Google/Facebook login).

## Suggested Review Notes text

```text
UMTUBA is an email/password short-video app.

Sign in with the reviewer account supplied in this note.
Open Watch to play a public video.
Create: pick a library video, check the Terms box, then Publish.
Owners can delete their own Watch video from the side rail.
Other people's videos show Report (reason list) and Block (hides that account on this device).
Settings → Blocked users lists device-local blocks.
Settings → Delete account opens https://umtuba.com/account-deletion
Settings → Help / Contact / Privacy open https://umtuba.com/privacy
Terms: https://umtuba.com/terms

Live is hidden on iOS in this build (join is not shipped).
Do not use Expo Go for auth redirects. Use this store/TestFlight binary.
Universal Links: https://umtuba.com/... and https://www.umtuba.com/...
Custom scheme: umtuba://auth/callback and umtuba://auth/update-password
```

## What reviewers should not be asked to test

- Live join / camera / microphone
- Learning, Store, or World as finished product surfaces
- A dedicated `/support` page (404). Use privacy/contact instead.
