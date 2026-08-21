/**
 * Watch header sits after the FlatList so the arrow can receive taps.
 * iOS expo-video uses AVPlayerLayer. A sibling overlay with zIndex/elevation
 * promotes the feed into a lower compositing layer; the item then stays in
 * "loading" while the poster/first frame is still visible.
 *
 * Build 20: header before the list, zIndex 2 — video layer stayed primary.
 * Build 21: header after the list, zIndex 20 — iPhone 13 Watch stalled.
 *
 * Document order (later sibling) is enough for hits. Never set zIndex on iOS.
 */

export type WatchHeaderOverlayLayerStyle = {
  zIndex?: number;
  elevation?: number;
};

export function shouldPromoteWatchHeaderStackingContext(
  platform: "ios" | "android" | string
): boolean {
  return platform !== "ios";
}

export function watchHeaderOverlayLayerStyle(
  platform: "ios" | "android" | string
): WatchHeaderOverlayLayerStyle {
  if (!shouldPromoteWatchHeaderStackingContext(platform)) {
    return {};
  }
  return { zIndex: 20, elevation: 20 };
}
