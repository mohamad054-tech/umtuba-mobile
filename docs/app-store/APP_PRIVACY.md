# App Privacy nutrition — evidence map (not a legal attestation)

Operator pastes answers into App Store Connect. Do not treat this file as a filed privacy label.

## Tracking

| Item | Answer | Evidence |
| --- | --- | --- |
| Used for Tracking? | No | `NSPrivacyTracking: false`; no ATT prompt; no advertising ID API |
| Tracking domains | None | `NSPrivacyTrackingDomains: []` |

## Data collected (from actual mobile behavior)

| Data type | Collected | Linked to identity | Used for tracking | Evidence |
| --- | --- | --- | --- | --- |
| Email address | Yes | Yes | No | Email/password auth |
| User ID | Yes | Yes | No | Supabase `auth.users` / profile |
| User content (video, caption) | Yes | Yes | No | Create publish to Watch `posts` |
| Photos or videos (library pick) | Yes | Yes | No | `expo-image-picker` Create flow |
| Other user content (messages) | Yes, if Messages is used | Yes | No | Messages tab |
| Product interaction (likes/saves) | Yes | Yes | No | `toggle_post_like` / viewer `post_saves` RLS (not `toggle_post_save`) |
| Crash / performance diagnostics | Only if Expo/EAS default telemetry is enabled by the operator build | No product analytics SDK in app source | No | No first-party analytics module |
| Precise location | No | — | — | World precise location fail-closed; not declared |
| Coarse location | No | — | — | Not requested |
| Purchases | No | — | — | No IAP |
| Advertising data | No | — | — | No ads SDK in this client |
| Contact info beyond email | No | — | — | — |
| Browse history / search history | Search exists in Discover; do not over-declare as tracking | Linked if signed in | No | In-app search only |

## Purpose strings (iOS)

| Permission | Declared | Why |
| --- | --- | --- |
| Photo Library | Yes | Choose a video to publish |
| Notifications | Yes | Likes, rewards, account activity |
| Camera | **Removed** | Live is hidden on iOS; Create uses the library picker only |
| Microphone | **Removed** | Same |

## Privacy policy / deletion

- Privacy: `https://umtuba.com/privacy`
- Account deletion: `https://umtuba.com/account-deletion` (Settings → Delete account)
- Support URL for ASC: `https://umtuba.com/support`

## Accessed-API reasons (privacy manifest)

Already in `app.config.ts`:

- UserDefaults `CA92.1`
- File timestamp `C617.1`
- System boot time `35F9.1`
- Disk space `E174.1`
