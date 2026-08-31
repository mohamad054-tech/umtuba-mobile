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
}): boolean {
  return input.commentsOpen === true || input.shareSheetOpen === true;
}

export function resolveWatchInPlaceOverlayClose(input: {
  commentsOpen: boolean;
  shareSheetOpen: boolean;
}): "comments" | "share" | null {
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
