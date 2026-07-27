import type { WorldMapProjection } from "@/src/lib/world/renderer/types";

/** At or below this zoom, auto mode prefers globe (when supported). */
export const GLOBE_AUTO_MAX_ZOOM = 4.2;

/** At or above this zoom, auto mode prefers mercator. Hysteresis band between thresholds. */
export const MERCATOR_AUTO_MIN_ZOOM = 5.0;

/**
 * Resolve auto projection from zoom with hysteresis.
 * Between GLOBE_AUTO_MAX_ZOOM and MERCATOR_AUTO_MIN_ZOOM, keeps current projection.
 */
export function resolveAutoProjection(
  zoom: number,
  current: WorldMapProjection
): WorldMapProjection {
  if (zoom <= GLOBE_AUTO_MAX_ZOOM) return "globe";
  if (zoom >= MERCATOR_AUTO_MIN_ZOOM) return "mercator";
  return current;
}
