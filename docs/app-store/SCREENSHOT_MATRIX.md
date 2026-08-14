# Screenshot matrix (capture on a device build — do not fabricate)

`SCREENSHOT_PLAN_READY = YES` (plan only). No screenshots are stored in this repo for submission.

## Required iPhone sizes (App Store Connect, 2026)

Capture **portrait** unless the app is landscape-only (it is portrait).

| Display | Typical device | Pixel size (portrait) | Required? |
| --- | --- | --- | --- |
| 6.9" | iPhone 16 Pro Max / 15 Pro Max | 1320 × 2868 or 1290 × 2796 | **Yes** |
| 6.5" | iPhone 14 Plus / 13 Pro Max / 12 Pro Max | 1284 × 2778 | Upload if ASC still shows the slot |
| 5.5" | iPhone 8 Plus | 1242 × 2208 | Only if ASC still requires it |

Use the EAS preview or production binary. Do not screenshot Expo Go.

## iPad

`supportsTablet` is **true** in `app.config.ts`. If that stays true, ASC will require **13" iPad** screenshots (2064 × 2752 or 2048 × 2732 portrait). Owner may set `supportsTablet: false` in a later change to drop iPad if they do not want tablet listing.

## Scenes to capture (same set on each required size)

1. **Watch** — public video playing, side rail visible (Like / Save / Report).
2. **Discover** — grid/search.
3. **Create** — library picker or caption + Terms checkbox (ack visible).
4. **Messages** — conversation list or empty honest state.
5. **Profile / Settings** — account deletion row visible is useful for review.
6. Optional: Report reason sheet; Blocked users list.

Do not show Live. Do not invent UI. Do not add marketing frames that hide the real app.

## Capture notes

- Dark UI is expected (`userInterfaceStyle: dark`).
- Status bar should be unobstructed.
- No debug banners, no Metro, no `.env` text.
- After capture, operator uploads in App Store Connect. This task does not upload.
