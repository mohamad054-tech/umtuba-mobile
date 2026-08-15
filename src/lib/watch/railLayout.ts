/** Compact enough for small iPhones; still meets 44pt hit targets. */
export const WATCH_RAIL_ACTION_MIN_HEIGHT = 44;
export const WATCH_RAIL_GAP = 8;
export const WATCH_RAIL_BOTTOM_EXTRA = 52;
export const WATCH_VOLUME_RIGHT_CLEARANCE = 68;

export function watchRailHeight(actionCount: number): number {
  if (actionCount <= 0) return 0;
  return (
    actionCount * WATCH_RAIL_ACTION_MIN_HEIGHT +
    (actionCount - 1) * WATCH_RAIL_GAP
  );
}

export function watchRailBottomOffset(bottomInset: number): number {
  const timelineBottom = Math.max(12, bottomInset + 10);
  return timelineBottom + WATCH_RAIL_BOTTOM_EXTRA;
}

/**
 * Owner rail: Like, Save, comments, share, Delete (5).
 * Other rail: Like, Save, comments, share, Report, Block (6).
 */
export function watchRailFitsCell(input: {
  cellHeight: number;
  actionCount: number;
  bottomInset: number;
  topReserved: number;
}): boolean {
  const used =
    input.topReserved +
    watchRailHeight(input.actionCount) +
    watchRailBottomOffset(input.bottomInset);
  return used <= input.cellHeight;
}
