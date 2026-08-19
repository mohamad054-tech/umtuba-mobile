/**
 * Editor overlay drag math. Watch playback stays display-only.
 * Coordinates are normalized centers (0..1) matching VIDEO_EDIT_STATE.
 */

import {
  clamp01,
  type VideoOverlayElement,
} from "@/src/lib/video/videoOverlays";

export const OVERLAY_DRAG_MIN_HIT = 44;

export function overlayHitSize(scale: number, edge: number): number {
  const visual = Number.isFinite(scale) && Number.isFinite(edge) ? scale * edge : 0;
  return Math.max(visual, OVERLAY_DRAG_MIN_HIT);
}

export function applyOverlayDrag(
  start: { x: number; y: number },
  dx: number,
  dy: number,
  width: number,
  height: number
): { x: number; y: number } {
  if (!(width > 0) || !(height > 0)) {
    return { x: clamp01(start.x), y: clamp01(start.y) };
  }
  return {
    x: clamp01(start.x + dx / width),
    y: clamp01(start.y + dy / height),
  };
}

export function hitTestOverlay(
  elements: VideoOverlayElement[],
  locationX: number,
  locationY: number,
  width: number,
  height: number
): string | null {
  if (!(width > 0) || !(height > 0) || elements.length === 0) {
    return null;
  }
  const edge = Math.min(width, height);
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i];
    if (!el) continue;
    const hit = overlayHitSize(el.scale, edge);
    const cx = el.x * width;
    const cy = el.y * height;
    const half = hit / 2;
    if (
      locationX >= cx - half &&
      locationX <= cx + half &&
      locationY >= cy - half &&
      locationY <= cy + half
    ) {
      return el.id;
    }
  }
  return null;
}
