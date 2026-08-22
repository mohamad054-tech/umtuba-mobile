/**
 * Watch header sits after the FlatList so the arrow can receive taps.
 * iOS expo-video uses AVPlayerLayer. A sibling overlay with zIndex/elevation
 * promotes the feed into a lower compositing layer; the item then stays in
 * "loading" while the poster/first frame is still visible.
 *
 * Build 20: header before the list, zIndex 2 — video layer stayed primary.
 * Build 21: header after the list, zIndex 20 — iPhone 13 Watch stalled.
 *
 * 48c510f moved Android elevation into a fresh object every render. On Fold6
 * that re-applies native elevation during Watch updates and can tear the
 * active TextureView surface so ExoPlayer never reaches readyToPlay.
 *
 * Document order (later sibling) is enough for hits. Never set zIndex on iOS.
 * Android keeps a module-stable elevation 20 style (same values as 15d9aec).
 */

export type WatchHeaderOverlayLayerStyle = {
  zIndex?: number;
  elevation?: number;
};

const IOS_HEADER_OVERLAY: WatchHeaderOverlayLayerStyle = Object.freeze({});
const ANDROID_HEADER_OVERLAY: WatchHeaderOverlayLayerStyle = Object.freeze({
  zIndex: 20,
  elevation: 20,
});

export function shouldPromoteWatchHeaderStackingContext(
  platform: "ios" | "android" | string
): boolean {
  return platform !== "ios";
}

export function watchHeaderOverlayLayerStyle(
  platform: "ios" | "android" | string
): WatchHeaderOverlayLayerStyle {
  if (!shouldPromoteWatchHeaderStackingContext(platform)) {
    return IOS_HEADER_OVERLAY;
  }
  return ANDROID_HEADER_OVERLAY;
}
