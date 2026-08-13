# UMTUBA iOS — operator packet (do not publish)

Prepared by PC2 operator mode. Not an App Store submission.
`IOS_APP_STORE_READY_FOR_BUILD = NO` until Apple Developer + Central GO.

## Identity (from repo, not invented)

| Field | Value |
| --- | --- |
| Name | UMTUBA |
| Bundle ID | `com.umtuba.app` |
| Version | `1.0.0` |
| iOS build | `1` (EAS production `autoIncrement: true`) |
| Scheme | `umtuba` |
| EAS projectId | `d2593b45-8f18-4c57-9d71-0419193cfd77` |

## Metadata candidates

- **Subtitle:** Watch. Create. Belong.
- **Category:** Social Networking (or Entertainment — owner picks)
- **Support:** `https://umtuba.com` (dedicated `/support` still missing)
- **Privacy:** `https://umtuba.com/privacy`
- **Terms:** `https://umtuba.com/terms`
- **Account deletion:** `https://umtuba.com/account-deletion` (public page observed 2026-08-13)
- **Marketing:** `https://umtuba.com`

Do not claim Learning/Store/Live as finished product surfaces.

## Age rating inputs (evidence, not a legal attestation)

- Users publish videos and captions (UGC)
- No in-app purchases in the mobile client
- No unrestricted web browser
- Messaging exists
- No mature-content filter product is evidenced

Likely Apple questionnaire outcome: **12+ or 17+** because of unrestricted UGC. Owner must complete the form. Do not self-declare 4+.

## Privacy nutrition (from actual app behavior)

Collect: email, user ID, user content (video/caption), photos/videos user picks, messages if used.
Do not declare: precise location, tracking, purchases, advertising ID.
`NSPrivacyTracking = false`.

## Reviewer instructions

1. Sign in with the operator-supplied email/password test account.
2. Watch a public video. Create requires Terms checkbox then Publish.
3. Owner can delete their own Watch video (UAF-12).
4. Settings → Delete account opens the web deletion page.
5. Live tab is hidden on iOS (join not shipped).
6. Universal Links need Apple Team ID + live AASA. Custom scheme `umtuba://` works on device builds.
7. Do not use Expo Go for auth redirects.

## Screenshot plan (capture later on a device build — do not fabricate)

iPhone 6.9" portrait: Watch, Discover, Create (Terms ack), Messages, Profile.
iPad only if `supportsTablet` stays true.

## EAS / TestFlight path (prepare only — no Central TestFlight GO)

```text
cd umtuba-mobile
npx expo login          # owner account
npx eas-cli login
npx eas-cli build --platform ios --profile preview
# After Apple creds + Central GO only:
npx eas-cli submit --platform ios --profile production --latest
```

Windows cannot run Xcode. Use EAS cloud.

## Still blocked for submission

- Apple Developer Individual enrollment / Team ID
- Expo/EAS login on this machine
- UGC report + block (Guideline 1.2) — not implemented; do not invent a backend
- Central TestFlight GO (absent)
- Central production App Store GO (absent)
