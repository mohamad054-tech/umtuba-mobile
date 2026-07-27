/**
 * Visual quality helpers — labels, clusters, zoom buckets.
 * Pure functions; no MapLibre imports.
 */

import type { WorldPlaceCityTier } from "@/src/lib/world/places";

/** Bucket zoom for layer refresh — reduces React re-renders during gestures. */
export const WORLD_ZOOM_BUCKET_STEP = 0.35;

/** Smooth cluster expand animation (ms). */
export const CLUSTER_EXPAND_ANIMATION_MS = 280;

/** Programmatic camera moves — slightly longer for stability. */
export const MAPLIBRE_GESTURE_CAMERA_ANIMATION_MS = 0;

/** Min zoom for city labels by tier — capitals first, minor last. */
export const PLACE_LABEL_MIN_ZOOM_BY_TIER: Record<WorldPlaceCityTier, number> =
  {
    capital: 4.2,
    major: 5.2,
    minor: 6.5,
  };

export function resolveWorldZoomBucket(
  zoom: number,
  step: number = WORLD_ZOOM_BUCKET_STEP
): number {
  if (!Number.isFinite(zoom)) return 0;
  const safeStep = step > 0 ? step : WORLD_ZOOM_BUCKET_STEP;
  const bucket = Math.round(zoom / safeStep) * safeStep;
  return Number(bucket.toFixed(2));
}

export function shouldRefreshForZoomBucket(
  previousBucket: number,
  nextZoom: number,
  step: number = WORLD_ZOOM_BUCKET_STEP
): boolean {
  return resolveWorldZoomBucket(nextZoom, step) !== previousBucket;
}

export function isPlaceLabelVisibleForTier(
  zoom: number,
  tier: WorldPlaceCityTier
): boolean {
  if (!Number.isFinite(zoom)) return false;
  return zoom >= PLACE_LABEL_MIN_ZOOM_BY_TIER[tier];
}

export function resolvePlaceLabelSortKey(tier: WorldPlaceCityTier): number {
  switch (tier) {
    case "capital":
      return 1;
    case "major":
      return 2;
    default:
      return 3;
  }
}

/**
 * Target zoom when expanding a cluster — small step avoids visual jumps.
 */
export function resolveClusterExpandZoom(
  currentZoom: number,
  clusterMaxZoom: number
): number {
  const z = Number.isFinite(currentZoom) ? currentZoom : clusterMaxZoom;
  const target = Math.min(clusterMaxZoom + 1.15, z + 1.4);
  return Math.max(z + 0.35, target);
}

/** Roads/buildings overlay refresh bucket — coarser at far zoom. */
export function resolveRoadsZoomBucket(zoom: number): number {
  if (!Number.isFinite(zoom)) return 0;
  if (zoom < 6) return Math.floor(zoom);
  if (zoom < 12) return Math.floor(zoom * 2) / 2;
  return resolveWorldZoomBucket(zoom, 0.5);
}
