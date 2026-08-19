/**
 * Editor overlay drag math. Watch playback stays display-only.
 * Coordinates are normalized centers (0..1) matching VIDEO_EDIT_STATE.
 *
 * Interaction lives in a physical LTR plane: finger-right always increases x
 * (overlay moves right). UI chrome may stay RTL; text writing direction is
 * independent and must not mirror gesture deltas.
 */

import {
  clamp01,
  type VideoOverlayElement,
} from "@/src/lib/video/videoOverlays";

export const OVERLAY_DRAG_MIN_HIT = 44;

/** Overlay canvas is physical/LTR even when the editor chrome is RTL. */
export const OVERLAY_INTERACTION_LAYOUT_DIRECTION = "ltr" as const;

export function overlayHitSize(scale: number, edge: number): number {
  const visual = Number.isFinite(scale) && Number.isFinite(edge) ? scale * edge : 0;
  return Math.max(visual, OVERLAY_DRAG_MIN_HIT);
}

/**
 * Apply a physical pointer delta. `dx`/`dy` are screen-space (finger right =
 * positive dx) and must never be sign-flipped for RTL/Arabic.
 */
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

export function overlayCanvasStyle(
  width: number,
  height: number
): {
  position: "absolute";
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  direction: typeof OVERLAY_INTERACTION_LAYOUT_DIRECTION;
} {
  return {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width,
    height,
    direction: OVERLAY_INTERACTION_LAYOUT_DIRECTION,
  };
}

/** Physical offset from the canvas origin (0,0 = top-left, +x = right). */
export function overlayElementPhysicalOffset(
  x: number,
  y: number,
  width: number,
  height: number,
  originOffset: number
): { translateX: number; translateY: number } {
  const safeWidth = width > 0 ? width : 0;
  const safeHeight = height > 0 ? height : 0;
  const half = Number.isFinite(originOffset) ? originOffset : 0;
  return {
    translateX: clamp01(x) * safeWidth - half,
    translateY: clamp01(y) * safeHeight - half,
  };
}

export function overlayElementTransform(
  x: number,
  y: number,
  rotation: number,
  width: number,
  height: number,
  originOffset: number
): Array<{ translateX: number } | { translateY: number } | { rotate: string }> {
  const offset = overlayElementPhysicalOffset(x, y, width, height, originOffset);
  const deg = Number.isFinite(rotation) ? rotation : 0;
  return [
    { translateX: offset.translateX },
    { translateY: offset.translateY },
    { rotate: `${deg}deg` },
  ];
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
