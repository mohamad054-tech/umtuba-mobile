/** Space kept above the system navigation bar so the last row is fully visible. */
export const SHEET_BOTTOM_COMFORT_PX = 20;

/**
 * Bottom padding for a sheet that reaches the screen edge.
 * Uses the larger of the live inset and the window inset so a menu
 * inside a tab still clears 3-button and gesture navigation.
 */
export function sheetBottomPadding(
  reportedInset: number,
  windowInset = 0
): number {
  const reported = Number.isFinite(reportedInset) ? Math.max(0, reportedInset) : 0;
  const window = Number.isFinite(windowInset) ? Math.max(0, windowInset) : 0;
  return Math.max(reported, window) + SHEET_BOTTOM_COMFORT_PX;
}
