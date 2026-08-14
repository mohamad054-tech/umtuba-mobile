# UMTUBA iOS — operator packet (do not publish)

Prepared by PC2 for `PC2_IOS_BUILD_APP_STORE_EXECUTION_PREPARATION_V2`.
Not an App Store submission. Do not upload to TestFlight or App Store from this packet.

`IOS_BUILD_CONFIG_READY` can be YES while `EAS_IOS_READY` is NO (operator must `eas login`).

## Identity (from committed config — do not invent IDs)

| Field | Value |
| --- | --- |
| Name | UMTUBA |
| Bundle ID | `com.umtuba.app` |
| Version | `1.0.0` |
| iOS build | `1` (EAS production `autoIncrement: true`) |
| Scheme | `umtuba` |
| EAS projectId | `d2593b45-8f18-4c57-9d71-0419193cfd77` |
| Apple Team ID | Set in `app.config.ts` `ios.appleTeamId` (same prefix already live in AASA) |
| Associated domains | `applinks:umtuba.com`, `applinks:www.umtuba.com` |

## Store listing copy (operator pastes into App Store Connect — do not publish from repo)

- **Name:** UMTUBA
- **Subtitle:** Watch. Create. Belong.
- **Category:** Social Networking (primary). Entertainment is the alternate if owner prefers.
- **Keywords:** watch, video, create, social, community, umtuba
- **Description:**

  UMTUBA is a short-video community. Watch public videos, publish your own clip after accepting the Terms, like and save posts, and manage your account.

  You can report a video, hide an account on this device, delete your own published video, and open the UMTUBA account-deletion page from Settings.

  Live, Learning, and Store are not finished iOS product surfaces in this build. Do not market them as shipped.

- **Promotional text (optional):** Watch short videos and publish your own. Report and hide content you do not want to see.
- **Support URL:** `https://umtuba.com/privacy` (dedicated `/support` is 404; privacy is the live contact/policy page)
- **Privacy URL:** `https://umtuba.com/privacy`
- **Marketing URL:** `https://umtuba.com`
- **Terms:** `https://umtuba.com/terms`
- **Account deletion URL:** `https://umtuba.com/account-deletion`

In-app Help, Contact, Privacy, and Terms open those same allowlisted pages. There is no separate in-app support ticket screen.

## Age rating inputs (evidence, not a legal attestation)

Owner must complete the App Store Connect questionnaire. Do not self-declare 4+.

| Question theme | Evidence in this build |
| --- | --- |
| User-generated content | Users publish videos and captions |
| Unrestricted UGC | No mature-content filter product is evidenced |
| Messaging | Messages tab exists |
| In-app purchases | None in the mobile client |
| Unrestricted web browser | No |
| Frequent / intense mature themes | Possible via UGC; owner decides 12+ vs 17+ |

Likely outcome: **12+ or 17+** because of unrestricted UGC.

## UGC disclosures (Guideline 1.2)

| Control | State |
| --- | --- |
| Terms acceptance before publish | Required checkbox on Create |
| Own-content deletion | Watch owner control (UAF-12) |
| Report objectionable content | Watch Report action with closed reasons |
| Block users | Watch Block + Settings → Blocked users (device-local until Central binds 20260928 UGC SQL) |
| Filter objectionable material | Reported posts and blocked authors are hidden on-device |
| Server-side moderation queue | **Not bound** — Desktop 20260928 UGC SQL is off alpha. Honest BLOCKER for submission. |

## App Privacy answers / evidence

See `APP_PRIVACY.md`. `NSPrivacyTracking = false`. Do not declare precise location, tracking, purchases, or advertising ID.

Collect: email, user ID, user content (video/caption), user-selected photos/videos, messages if used.

## Reviewer instructions

See `REVIEWER_NOTES.md`. A real email/password reviewer account is **required** and is **not created in this repo**.

## Screenshot matrix

See `SCREENSHOT_MATRIX.md`. Capture later on a device build. Do not fabricate screenshots.

## EAS / TestFlight path (prepare only)

```text
cd umtuba-mobile
npx expo login
npx eas-cli login
# Config-only is enough for this task. Prefer not to start a cloud build
# unless Expo/EAS are already logged in and the build is a local non-submit preview.
# After Apple creds + Central GO only:
npx eas-cli build --platform ios --profile preview
npx eas-cli submit --platform ios --profile production --latest
```

Windows cannot run Xcode. Use EAS cloud. Do not submit from this packet.

## Still blocked for submission

- Expo/EAS login on this machine
- Server-side UGC report queue (20260928 SQL off alpha)
- Reviewer email/password account (owner must create)
- Device screenshots (none captured)
- Central TestFlight GO (absent)
- Central production App Store GO (absent)
