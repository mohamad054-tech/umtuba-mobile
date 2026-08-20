/** Readable social-profile column — not a stretched phone layout. */
export const PROFILE_READABLE_MAX_WIDTH = 560;

/**
 * Width at/above this uses the readable column.
 * Fold6 unfolded inner (~690dp) qualifies; folded cover (~370dp) does not.
 */
export const PROFILE_LARGE_SCREEN_MIN_WIDTH = 600;

/** Fold6 cover (folded) — logical dp used by Central QA. */
export const FOLD6_FOLDED_WIDTH_DP = 373;

/** Fold6 inner (unfolded) — logical dp used by Central QA. */
export const FOLD6_UNFOLDED_WIDTH_DP = 690;

export function isProfileLargeScreen(windowWidth: number): boolean {
  return Number.isFinite(windowWidth) && windowWidth >= PROFILE_LARGE_SCREEN_MIN_WIDTH;
}

/** Full width on phone/folded; capped + centered on unfolded / large screens. */
export function resolveProfileContentWidth(windowWidth: number): number {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) {
    return PROFILE_READABLE_MAX_WIDTH;
  }
  if (!isProfileLargeScreen(windowWidth)) {
    return windowWidth;
  }
  return Math.min(windowWidth, PROFILE_READABLE_MAX_WIDTH);
}
