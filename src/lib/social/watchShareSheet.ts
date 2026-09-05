/**
 * In-Watch share chooser. Stays on the live Watch instance.
 * Dismiss must not remount Watch or change the active item.
 */

export type WatchShareSheetSnapshot = {
  postId: number;
  title: string;
  text: string;
  activeItemId: string;
};

export function isWatchShareSheetOpen(
  snapshot: WatchShareSheetSnapshot | null | undefined
): boolean {
  return snapshot != null && Number.isInteger(snapshot.postId) && snapshot.postId > 0;
}

export function isWatchInPlaceOverlayOpen(input: {
  commentsOpen: boolean;
  shareSheetOpen: boolean;
  publishedEditorOpen?: boolean;
}): boolean {
  return (
    input.commentsOpen === true ||
    input.shareSheetOpen === true ||
    input.publishedEditorOpen === true
  );
}

export function resolveWatchInPlaceOverlayClose(input: {
  commentsOpen: boolean;
  shareSheetOpen: boolean;
  publishedEditorOpen?: boolean;
}): "comments" | "share" | "published-editor" | null {
  if (input.publishedEditorOpen) return "published-editor";
  if (input.commentsOpen) return "comments";
  if (input.shareSheetOpen) return "share";
  return null;
}

export function shouldDismissWatchShareOnHardwareBack(
  shareSheetOpen: boolean
): boolean {
  return shareSheetOpen === true;
}

export function watchShareSheetRemountsWatch(): false {
  return false;
}

export function watchShareDismissPreservesActiveItem(): true {
  return true;
}

export function watchShareOverlayPausesPlayback(): false {
  return false;
}

/** Mount only while open. A standing RN Modal Dialog steals Android TextureView. */
export function shouldMountWatchShareOverlay(
  snapshot: WatchShareSheetSnapshot | null | undefined
): boolean {
  return isWatchShareSheetOpen(snapshot);
}

/**
 * Stay in the Watch host window. A second Android Dialog next to
 * TextureView can play item-2 audio on a black surface and jump the list.
 */
export function watchShareOverlayUsesHostWindow(): true {
  return true;
}
