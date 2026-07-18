# UMTUBA Mobile (Foundation V1)

Expo Router app sharing domain contracts with `umtuba-web` (Watch feed, auth, wallet/tiers, referral attribution).

## Windows setup

1. Install **Node.js 20+** (LTS recommended).
2. Open a terminal in this folder:

```powershell
cd C:\Users\Admin\Desktop\umtuba\umtuba-mobile
npm install
```

3. Copy env and fill Supabase **publishable** values (never a service-role key):

```powershell
copy .env.example .env
```

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key
# Optional
EXPO_PUBLIC_LIVEKIT_URL=
```

4. Start Expo:

```powershell
npx expo start
```

5. Run on an **Android phone** (same Wi‑Fi as your PC):

```powershell
npx expo start
```

- Install **Expo Go** from the Play Store on the phone.
- Scan the QR code from the terminal (or Expo Dev Tools in the browser).
- Or press `a` if an Android emulator is running.

LAN tip: if the phone cannot reach Metro, press `s` to switch to tunnel mode, or set your PC firewall to allow Node.js inbound connections.

### iOS

Building or running the iOS simulator requires a **Mac** with Xcode. On Windows you can still develop against Android / Expo Go.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo dev server |
| `npm run typecheck` / `npm run lint` | `tsc --noEmit` |
| `npm test` | Vitest (node) |

## Deep link examples

```
umtuba://watch?post=123
umtuba://profile/alice
umtuba://live
umtuba://invite/ABC123XY
umtuba://rewards
umtuba://notifications
https://umtuba.com/invite/ABC123XY
```

Invite / `?ref=` codes are stored first-touch for 30 days (`umtuba_ref` + `umtuba_vid` in SecureStore).

## Architecture notes

- Contracts live under `src/contracts/` — see `SHARED.md`.
- Supabase client uses Expo SecureStore for auth (AsyncStorage fallback documented in `src/lib/supabase/client.ts`).
- Watch tab: vertical paging FlatList + `expo-av` Video; only the active index plays.

## Phase 2

- Create composer + video upload/publish
- Discover grid + search
- Live lobby + LiveKit
- Messages / DMs
- Notifications inbox + push
- Rich profile / settings
- Universal Links / App Links production verification
