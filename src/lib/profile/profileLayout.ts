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

/** Timeline side gutter — kept in sync with Profile `styles.timeline`. */
export const PROFILE_TIMELINE_GUTTER_DP = 20;

/** Post card padding — kept in sync with Profile `styles.postCard`. */
export const PROFILE_POST_CARD_PADDING_DP = 14;

/**
 * Phone / folded contain box (width / height). Taller than 16:9 so 9:16 Watch
 * posters stay a usable full frame instead of a letterboxed stamp.
 */
export const PROFILE_MEDIA_NARROW_ASPECT = 4 / 5;

/** Unfolded / large-screen contain box — keeps the readable column compact. */
export const PROFILE_MEDIA_WIDE_ASPECT = 16 / 9;

/** Hard cap so one post cannot eat the whole wall. */
export const PROFILE_MEDIA_MAX_HEIGHT_DP = 420;

/** Never cover-crop Profile post media; letterbox/pillarbox instead. */
export const PROFILE_MEDIA_RESIZE_MODE = "contain" as const;

/** Decorative cover band height (layout container only — no branded bitmap). */
export const PROFILE_COVER_HEIGHT_DP = 148;

/** Overlapping circular avatar. */
export const PROFILE_AVATAR_SIZE_DP = 92;

export type ProfileMediaBox = {
  width: number;
  height: number;
  aspectRatio: number;
};

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

export function resolveProfileMediaInnerWidth(columnWidth: number): number {
  if (!Number.isFinite(columnWidth) || columnWidth <= 0) {
    return 0;
  }
  return Math.max(
    0,
    columnWidth - PROFILE_TIMELINE_GUTTER_DP * 2 - PROFILE_POST_CARD_PADDING_DP * 2
  );
}

/** Wider aspect = shorter box. Phone/folded uses 4:5; large screens keep 16:9. */
export function resolveProfileMediaAspect(windowWidth: number): number {
  return isProfileLargeScreen(windowWidth)
    ? PROFILE_MEDIA_WIDE_ASPECT
    : PROFILE_MEDIA_NARROW_ASPECT;
}

/**
 * Reserved Profile media box. `contain` draws the full frame inside this box;
 * height is capped so the list stays usable.
 */
export function resolveProfileMediaBox(
  windowWidth: number,
  columnWidth: number = resolveProfileContentWidth(windowWidth)
): ProfileMediaBox {
  const width = resolveProfileMediaInnerWidth(columnWidth);
  const preferredAspect = resolveProfileMediaAspect(windowWidth);
  const uncappedHeight = width > 0 ? width / preferredAspect : 0;
  const height = Math.min(uncappedHeight, PROFILE_MEDIA_MAX_HEIGHT_DP);
  const aspectRatio = height > 0 ? width / height : preferredAspect;
  return { width, height, aspectRatio };
}

/** True when a source frame fits entirely inside the box under contain (no crop). */
export function containedFrameFitsBox(
  frameAspect: number,
  box: Pick<ProfileMediaBox, "width" | "height">
): boolean {
  if (
    !Number.isFinite(frameAspect) ||
    frameAspect <= 0 ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return false;
  }
  const fittedWidth = Math.min(box.width, box.height * frameAspect);
  const fittedHeight = fittedWidth / frameAspect;
  return (
    fittedWidth <= box.width + 1e-6 && fittedHeight <= box.height + 1e-6
  );
}
