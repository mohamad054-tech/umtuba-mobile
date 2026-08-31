/** Compact enough for small iPhones; still meets 44pt hit targets. */
export const WATCH_RAIL_ACTION_MIN_HEIGHT = 44;
export const WATCH_RAIL_GAP = 8;
/**
 * Clears the timeline clock row + tall scrub hit. 52px sat the last rail
 * label (Delete / Supprimer / Eliminar) on top of the duration clock.
 */
export const WATCH_RAIL_BOTTOM_EXTRA = 84;
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

export function watchRailShouldCompact(input: {
  cellHeight: number;
  actionCount: number;
  bottomInset: number;
  topReserved: number;
}): boolean {
  return !watchRailFitsCell(input);
}
