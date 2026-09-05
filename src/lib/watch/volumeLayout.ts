import { clampUnitRatio } from "./playbackPolicy";
import { watchRailBottomOffset, watchRailHeight } from "./railLayout";

/** Opposite the action rail (physical right in LTR and RTL). */
export const WATCH_VOLUME_SIDE = "left" as const;

/** Short vertical track — must not read as a top bar. */
export const WATCH_VOLUME_SLIDER_LENGTH = 112;

export const WATCH_VOLUME_TOUCH_TARGET = 44;
export const WATCH_VOLUME_AUTO_HIDE_MS = 2200;
export const WATCH_VOLUME_TRACK_THICKNESS = 3;
export const WATCH_VOLUME_ICON_GAP = 6;
export const WATCH_VOLUME_LABEL_HEIGHT = 16;
export const WATCH_VOLUME_EDGE_PADDING = 4;
export const WATCH_VOLUME_TOP_EXTRA = 10;
export const WATCH_VOLUME_OVERLAY_PADDING = 16;

/** Captions + username + timeline sit in this bottom band. */
export const WATCH_VOLUME_BOTTOM_CONTENT_RESERVE = 168;

export const WATCH_VOLUME_COLLAPSED_HEIGHT = WATCH_VOLUME_TOUCH_TARGET;

export const WATCH_VOLUME_EXPANDED_HEIGHT =
  WATCH_VOLUME_LABEL_HEIGHT +
  WATCH_VOLUME_ICON_GAP +
  WATCH_VOLUME_SLIDER_LENGTH +
  WATCH_VOLUME_ICON_GAP +
  WATCH_VOLUME_TOUCH_TARGET;

export const WATCH_VOLUME_USES_TOP_BAR = false;

export type WatchVolumeSide = typeof WATCH_VOLUME_SIDE;
export type WatchVolumeIconKind = "muted" | "low" | "high";

export type WatchRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Action rail is absolutely `right`-anchored in WatchVideoCard for both
 * directions, so volume stays on the physical left in LTR and RTL.
 */
export function resolveWatchVolumeSide(_isRtl: boolean): WatchVolumeSide {
  return WATCH_VOLUME_SIDE;
}

/** Top of the track is 100% volume; bottom is 0%. */
export function resolveVerticalVolumeRatio(
  pageY: number,
  trackY: number,
  trackHeight: number
): number {
  if (!Number.isFinite(pageY) || !Number.isFinite(trackY)) return 0;
  if (!Number.isFinite(trackHeight) || trackHeight <= 0) return 0;
  return clampUnitRatio(1 - (pageY - trackY) / trackHeight);
}

export function resolveWatchVolumeLeft(input: {
  leftInset: number;
  overlayPadding?: number;
}): number {
  const overlayPadding = input.overlayPadding ?? WATCH_VOLUME_OVERLAY_PADDING;
  const inset = Number.isFinite(input.leftInset) ? Math.max(0, input.leftInset) : 0;
  return Math.max(
    WATCH_VOLUME_EDGE_PADDING,
    inset - overlayPadding + WATCH_VOLUME_EDGE_PADDING
  );
}

export function resolveWatchVolumeTop(input: {
  cellHeight: number;
  topInset: number;
  bottomInset: number;
  expanded: boolean;
}): number {
  const height = input.expanded
    ? WATCH_VOLUME_EXPANDED_HEIGHT
    : WATCH_VOLUME_COLLAPSED_HEIGHT;
  const minTop = Math.max(0, input.topInset + WATCH_VOLUME_TOP_EXTRA);
  if (!Number.isFinite(input.cellHeight) || input.cellHeight <= 0) {
    return minTop;
  }
  const reservedBottom = Math.max(
    WATCH_VOLUME_BOTTOM_CONTENT_RESERVE,
    input.bottomInset + 130
  );
  const maxTop = Math.max(minTop, input.cellHeight - reservedBottom - height);
  const preferred = minTop + Math.max(0, (maxTop - minTop) * 0.32);
  return Math.min(maxTop, Math.max(minTop, preferred));
}

export function watchVolumeSliderVisible(input: {
  expanded: boolean;
  lastInteractAt: number;
  now: number;
  gestureActive?: boolean;
}): boolean {
  if (!input.expanded) return false;
  if (input.gestureActive) return true;
  if (!Number.isFinite(input.lastInteractAt) || !Number.isFinite(input.now)) {
    return false;
  }
  return input.now - input.lastInteractAt < WATCH_VOLUME_AUTO_HIDE_MS;
}

export function resolveWatchVolumeIcon(input: {
  muted: boolean;
  volume: number;
}): WatchVolumeIconKind {
  if (input.muted || input.volume <= 0) return "muted";
  if (input.volume < 0.5) return "low";
  return "high";
}

export function watchVolumeIconGlyph(kind: WatchVolumeIconKind): string {
  if (kind === "muted") return "🔇";
  if (kind === "low") return "🔈";
  return "🔊";
}

export function rectsOverlap(a: WatchRect, b: WatchRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function watchVolumeFrame(input: {
  cellWidth: number;
  cellHeight: number;
  topInset: number;
  bottomInset: number;
  leftInset: number;
  expanded: boolean;
  isRtl: boolean;
  overlayPadding?: number;
}): WatchRect {
  const overlayPadding = input.overlayPadding ?? WATCH_VOLUME_OVERLAY_PADDING;
  const side = resolveWatchVolumeSide(input.isRtl);
  const height = input.expanded
    ? WATCH_VOLUME_EXPANDED_HEIGHT
    : WATCH_VOLUME_COLLAPSED_HEIGHT;
  const width = WATCH_VOLUME_TOUCH_TARGET;
  const insetX = resolveWatchVolumeLeft({
    leftInset: input.leftInset,
    overlayPadding,
  });
  const x =
    side === "left"
      ? overlayPadding + insetX
      : input.cellWidth - overlayPadding - insetX - width;
  return {
    x,
    y: resolveWatchVolumeTop(input),
    width,
    height,
  };
}

export function watchChromeRects(input: {
  cellWidth: number;
  cellHeight: number;
  topInset: number;
  bottomInset: number;
  actionCount?: number;
}): {
  back: WatchRect;
  rail: WatchRect;
  captions: WatchRect;
  progress: WatchRect;
} {
  const actionCount = input.actionCount ?? 6;
  const timelineBottom = Math.max(12, input.bottomInset + 10);
  const railBottom = watchRailBottomOffset(input.bottomInset);
  const railHeight = watchRailHeight(actionCount);
  const captionHeight = 84;
  return {
    back: {
      x: 0,
      y: 0,
      width: 52,
      height: Math.max(44, input.topInset),
    },
    rail: {
      x: input.cellWidth - 12 - 44,
      y: input.cellHeight - railBottom - railHeight,
      width: 44,
      height: railHeight,
    },
    captions: {
      x: 16,
      y: input.cellHeight - timelineBottom - 36 - captionHeight,
      width: Math.round(input.cellWidth * 0.72),
      height: captionHeight,
    },
    progress: {
      x: 16,
      y: input.cellHeight - timelineBottom - 48,
      width: Math.max(0, input.cellWidth - 32),
      height: 48,
    },
  };
}

export function watchVolumeAvoidsChrome(input: {
  cellWidth: number;
  cellHeight: number;
  topInset: number;
  bottomInset: number;
  leftInset: number;
  expanded: boolean;
  isRtl: boolean;
  actionCount?: number;
}): boolean {
  const volume = watchVolumeFrame(input);
  const chrome = watchChromeRects(input);
  return (
    !rectsOverlap(volume, chrome.back) &&
    !rectsOverlap(volume, chrome.rail) &&
    !rectsOverlap(volume, chrome.captions) &&
    !rectsOverlap(volume, chrome.progress)
  );
}
