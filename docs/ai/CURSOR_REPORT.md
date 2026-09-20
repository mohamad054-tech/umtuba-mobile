# Cursor Report — Android build 23 source (PostHog + audio handoff)

## Summary

Prepared `feat/build-23` from production build 22 source `aa57b8ae`. Added PostHog EU analytics (same project as the website) and ported the audio-bleed gate onto the clean-room Watch engine without merging the conflicting watch.tsx / WatchVideoCard.tsx branches. Fixed the `WATCH_BACK_DOUBLE_PRESS` beforeRemove re-arm race. versionName `1.0.23`. Local `versionCode` stays `22` so EAS `appVersionSource: remote` + `autoIncrement` produces 23. minSdk unchanged. No EAS build. No Play submit. `master` not pushed.

## Exact files changed

See git commit. Principal surfaces:

- `app.config.ts`, `package.json`, `package-lock.json`, `.env.example`
- `app/_layout.tsx`, `app/(auth)/signup.tsx`, `app/(tabs)/discover.tsx`, `app/(tabs)/watch.tsx`
- `src/lib/analytics/*` (new)
- `src/lib/auth/AuthContext.tsx`
- `src/lib/social/comments.ts`, `interactions.ts`, `ugcModeration.ts`
- `src/lib/video/optimisticPublishPipeline.ts`
- `src/lib/watch/engine/audioHandoff.ts` (new) + tests
- `src/lib/watch/engine/WatchEnginePlayer.tsx`, `index.ts`
- `components/WatchEngineHost.tsx`
- `src/lib/nav/watchRootExit.ts` + test
- `src/lib/ios/appStoreConfig.test.ts` (version assertions)
- `docs/ai/CURRENT_TASK.md`, `docs/ai/CURSOR_REPORT.md`

## Migrations created

none

## PostHog

- Package: `posthog-react-native@4.75.0`
- Host: `https://eu.i.posthog.com`
- Key/host from `process.env.EXPO_PUBLIC_POSTHOG_KEY` and `process.env.EXPO_PUBLIC_POSTHOG_HOST` (literals) plus `extra.posthogKey` / `extra.posthogHost` in `app.config.ts`
- Missing/invalid key → analytics disabled, app still runs
- Source test proves the key is read as a literal, not `process.env[name]`
- Identify: Supabase user id only. Reset on logout. No email/name/phone/typed text
- Session replay off (`enableSessionReplay: false`)
- Touch autocapture not enabled (constructor, not PostHogProvider-with-touches)
- Lifecycle events left on (`captureAppLifecycleEvents` default true) for out-of-the-box **Application Installed / Updated / Opened**
- Extra install-attribution SDKs (Meta/Google/AppsFlyer/ATT/advertising-id): **not added**

### Event list (typed helper `track` / `ANALYTICS_EVENTS`)

| Event | When | Props |
| --- | --- | --- |
| `app_opened` | After successful PostHog init | `platform` |
| `sign_up_started` | Signup submit | `surface` |
| `sign_up_completed` | Auth signup success | none |
| `login` | Password sign-in success | none |
| `video_view` | Watch first frame of a post | `post_id`, `surface` |
| `video_like` | Like RPC liked=true | `post_id` |
| `video_share` | Share RPC recorded | `post_id` |
| `comment_posted` | Comment insert success | `post_id` |
| `post_published` | Optimistic publish success | `post_id` |
| `search_performed` | Discover search results/empty | `surface` only — no query text |
| `report_submitted` | Post or user report accepted | `kind` |

Website PostHog source was not found in the local umtuba-web trees searched. Names follow the owner list exactly.

Local `npx expo config` showed `extra.posthogKey` / `posthogHost` as empty because those env vars are not set in this shell. **EAS production must set `EXPO_PUBLIC_POSTHOG_KEY=phc_…` and `EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` or the app will ship with analytics disabled.** That empty extra is the proof the values come from env, not a hardcoded fallback.

## Audio fix

### Already in aa57b8ae clean-room engine

- `resolveWatchEngineAudioOwner` silences every mounted player while settling until incoming first frame, then one owner
- `WatchEnginePlayer` starts muted/volume 0
- Unit tests already assert outgoing is in the silence set before incoming is audible
- **Not enough on device:** JS decision still waits for React effects; ExoPlayer can keep the previous clip audible

### Still needed (ported, not force-merged)

From `e0ad65e` / `3c092f8`, rewritten against media ids:

- Immediate mute + volume 0 + pause of the outgoing player on release
- Hold incoming silent
- Gate incoming unmute until outgoing **native** `playing === false`
- Hide the current surface until first frame (`opacity: 0`) so an unpainted incoming texture is not shown

Did **not** merge `desktop/watch-audio-clean-handoff-source-fix-v1` or `desktop/watch-rapid-handoff-audio-visual-source-fix-v1` into `watch.tsx` / `WatchVideoCard.tsx`.

## WATCH_BACK_DOUBLE_PRESS

Genuinely broken in wiring: the confirming back called `clearExitArm()` then `beforeRemove` saw unarmed + `canGoBack` and re-armed (`DOUBLE_BACK_REARMS`).

Fix: `exitingWatchRef` + `resolveWatchBeforeRemove({ exiting })` so a confirming GO_BACK is allowed through. Source-certified only. Still needs Fold6 OWNER_PASS.

## Play Console data-safety updates needed

PostHog EU will collect after the EAS env is set. Update Data safety / Data collection:

1. **App activity** — yes: analytics events (app open, signup, login, video view/like/share, comment, publish, search performed without query, report submitted)
2. **App info and performance** — diagnostics via PostHog (device/app properties the SDK attaches). Not crash-reporting as a separate product
3. **Device or other IDs** — yes: PostHog distinct id; identified users use **Supabase user id** (not email)
4. **Advertising ID** — no new advertising-id SDK. Do not declare ads ID unless Play later shows a library pulling it
5. **Approximate location** — PostHog may geo-resolve IP on their EU host. If the declaration currently says no location, update to approximate location collected for analytics, or disable GeoIP in the PostHog project
6. **Purpose** — Analytics only. Not advertising, not sold
7. **Optional / required** — collection starts if the public key is present; users cannot toggle it in-app yet
8. **Privacy policy** — must mention PostHog EU (`eu.i.posthog.com`), identifiers, and that search text / email / name / phone / comment body are not sent
9. **Data deletion** — PostHog project must support user-deletion requests tied to the Supabase user id
10. Session recording: **do not** declare screen recording; it is off

Listing store text: no change required beyond privacy-policy accuracy.

## Security review

- PostHog project API key is a public client key; still not hardcoded in app source
- No `.env` committed. No service-role key
- Analytics props strip email/name/phone/query/body
- Identify uses user id only
- No session replay package

## Tests

- `npx tsc --noEmit` PASS
- New/focused vitest PASS: analytics, audio handoff, audio decision, watchRootExit, engineGate
- Full `npx vitest run`: **1128+ passed**; remaining failures are **pre-existing on aa57b8ae** and not introduced by this work:
  - `appStoreConfig.test.ts` camera/mic + Android CAMERA/RECORD_AUDIO (config on aa57b8ae already declares UM Streak camera/mic)
  - `wallet/format.test.ts` locale grouping on this machine (`١٬٢٣٤`)
- `npx expo config --type public` PASS — version `1.0.23`, `versionCode` 22, extra posthog keys present (empty without env)

## TypeScript

PASS

## Build

EAS build **not run** (forbidden). Local Expo config resolved. No `expo prebuild` / export (would mutate android/ or take a full bundle).

## git diff --check

PASS on the commit files (run at commit time).

## git status --short

See after commit.

## Device-only verification (cannot do here)

- Audio bleed on Fold6 / closed-testing Alpha (WATCH_NO_AUDIO_BLEED)
- Double-back exit vs re-arm when `canGoBack` (WATCH_BACK_DOUBLE_PRESS)
- PostHog events arriving in the EU project, including `$app_install` / Application Installed
- Cross-surface identity (web + app same distinct id after login)
- Limit Ad Tracking: no extra SDK; OS LAT not read. Confirm in PostHog that no advertising ID is attached
- Empty-key production path if EAS env is forgotten (analytics off, no crash)

## Open issues

- Set EAS env for production before the real build 23
- Website PostHog source not located in local web worktrees
- Camera/mic appStoreConfig tests still fail on this base (pre-existing)
- Do not merge this to master or submit to Play until Fold6 pass
