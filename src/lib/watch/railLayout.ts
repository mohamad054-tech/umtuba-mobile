/** Compact enough for small iPhones; still meets 44pt hit targets. */
export const WATCH_RAIL_ACTION_MIN_HEIGHT = 44;
export const WATCH_RAIL_GAP = 8;
/**
 * Clears the thin 2px progress track at the cell bottom. The old 84px extra
 * reserved the clock row + tall scrub hit that covered the video.
 */
export const WATCH_RAIL_BOTTOM_EXTRA = 28;
/** Where the action stack's center sits, measured up from the cell bottom. */
export const WATCH_RAIL_LOWER_HALF_ANCHOR = 0.3;
/** Small lift so the name stays clear of the bottom bar. */
export const WATCH_META_BOTTOM_LIFT = 18;
/** Flush to the Watch cell bottom so the track does not sit on the picture. */
export const WATCH_TIMELINE_BOTTOM = 0;
export const WATCH_PROGRESS_TRACK_HEIGHT = 2;
/** Keeps long action labels inside the rail column, not over the clock. */
export const WATCH_RAIL_ACTION_LABEL_MAX_WIDTH = 72;
/** Physical-right gutter so the duration clock stays left of the rail. */
export const WATCH_TIMELINE_TRAILING_GUTTER = 56;
export const WATCH_VOLUME_RIGHT_CLEARANCE = 68;
/** Tighter rail only when the cell is shorter than the full 8pt-gap stack. */
export const WATCH_RAIL_COMPACT_GAP = 4;
/** Header chips + follow row reserved above the rail column. */
export const WATCH_HEADER_RAIL_RESERVED = 120;

export function watchRailHeight(
  actionCount: number,
  options?: { compact?: boolean }
): number {
  if (actionCount <= 0) return 0;
  const gap = options?.compact ? WATCH_RAIL_COMPACT_GAP : WATCH_RAIL_GAP;
  return (
    actionCount * WATCH_RAIL_ACTION_MIN_HEIGHT + (actionCount - 1) * gap
  );
}

export function watchTimelineBottom(_bottomInset?: number): number {
  return WATCH_TIMELINE_BOTTOM;
}

export function watchMetaBottom(bottomInset: number): number {
  return watchTimelineBottom(bottomInset) + 10 + WATCH_META_BOTTOM_LIFT;
}

export function watchRailBottomOffset(
  bottomInset: number,
  cellHeight = 0,
  actionCount = 0,
  compact = false
): number {
  const minClear = watchTimelineBottom(bottomInset) + WATCH_RAIL_BOTTOM_EXTRA;
  if (!(cellHeight > 0) || actionCount <= 0) return minClear;
  const railHeight = watchRailHeight(actionCount, { compact });
  const desired = Math.round(cellHeight * WATCH_RAIL_LOWER_HALF_ANCHOR - railHeight / 2);
  const maxBottom = cellHeight - WATCH_HEADER_RAIL_RESERVED - railHeight - 8;
  if (maxBottom < minClear) return minClear;
  return Math.max(minClear, Math.min(desired, maxBottom));
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

export function watchRailShouldCompact(input: {
  cellHeight: number;
  actionCount: number;
  bottomInset: number;
  topReserved: number;
}): boolean {
  return !watchRailFitsCell(input);
}
