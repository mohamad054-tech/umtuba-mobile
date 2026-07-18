# Shared contracts (mobile ↔ web)

Framework-neutral copies of domain rules used by both `umtuba-web` and `umtuba-mobile`.

## Shared (keep in sync)

| Module | Contents |
|--------|----------|
| `validation.ts` | Username / email / password helpers, error message parsing |
| `referral.ts` | Referral code normalize, cookie/key names, TTL, invite paths |
| `video.ts` | `POST_VIDEOS_BUCKET`, signed URL TTL, size/caption limits |
| `wallet.ts` | `WalletBalance`, `PRIMARY_WALLET_ASSET_ID` (`um_points`) |
| `tiers.ts` | `ACTIVITY_TIERS`, `resolveTierFromScore`, progress helpers |
| `watch.ts` | `WatchVideo`, feed cursor/page types, `WATCH_FEED_PAGE_SIZE` |

## Platform-specific (do not copy blindly)

| Concern | Web | Mobile |
|---------|-----|--------|
| Auth session storage | Cookies / SSR client | Expo SecureStore (+ AsyncStorage fallback note) |
| Referral attribution | HTTP cookies | SecureStore first-touch keys |
| Video playback | HTML `<video>` / web player | `expo-video` `VideoPlayer` + `VideoView` |
| Deep links | Next.js routes | `umtuba://` + universal links via expo-linking |
| Env | `NEXT_PUBLIC_*` / server secrets | `EXPO_PUBLIC_*` publishable key only — never service role |
| Permissions | Browser prompts | `expo-camera` / mic / media-library / notifications wrappers |

When changing a shared rule on web, update the matching file here (or extract a future shared package).
