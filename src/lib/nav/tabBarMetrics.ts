/**
 * Primary tab icon / touch metrics. Watch / Discover / Create were 11pt
 * text glyphs inside the default Expo icon slot — too small to recognize
 * or tap comfortably. Create stays slightly larger as the publish action.
 */
export const TAB_ICON_SIZE_BEFORE = 11;
export const TAB_ICON_SIZE = 24;
export const TAB_ICON_SIZE_CREATE = 28;
export const TAB_ICON_STROKE = 2.4;
export const TAB_BAR_MIN_HEIGHT = 56;
export const TAB_ITEM_MIN_HEIGHT = 48;
export const TAB_LABEL_FONT_SIZE = 10;
export const TAB_LABEL_MAX_WIDTH = 76;

export type PrimaryTabId =
  | "watch"
  | "discover"
  | "create"
  | "live"
  | "messages"
  | "profile";

export function tabIconSize(id: PrimaryTabId): number {
  return id === "create" ? TAB_ICON_SIZE_CREATE : TAB_ICON_SIZE;
}
