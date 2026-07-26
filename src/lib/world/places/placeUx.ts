/**
 * Places UX — city tiers, layer ids, zoom/label/cluster helpers.
 * Pure logic; no MapLibre imports.
 */

import type {
  WorldPlace,
  WorldPlaceCityTier,
} from "@/src/lib/world/places/types";

export type { WorldPlaceCityTier };

export type WorldPlaceLayerId =
  | "cities_capitals"
  | "cities_major"
  | "cities_minor";

export const PLACE_LAYER_CAPITALS = "cities_capitals" as const;
export const PLACE_LAYER_MAJOR = "cities_major" as const;
export const PLACE_LAYER_MINOR = "cities_minor" as const;

export const ALL_PLACE_LAYER_IDS: readonly WorldPlaceLayerId[] = [
  PLACE_LAYER_CAPITALS,
  PLACE_LAYER_MAJOR,
  PLACE_LAYER_MINOR,
];

export const PLACE_LAYER_LABELS: Record<WorldPlaceLayerId, string> = {
  cities_capitals: "Capitals",
  cities_major: "Major Cities",
  cities_minor: "Minor Cities",
};

/** Labels appear at/above this zoom (avoid clutter when far). */
export const PLACE_LABEL_MIN_ZOOM = 4.2;

/** Clusters active below this zoom; above it, points separate. */
export const PLACE_CLUSTER_MAX_ZOOM = 5;

/** Camera zoom when focusing a selected place. */
export const PLACE_FOCUS_ZOOM = 6.5;

export function resolvePlaceCityTier(place: WorldPlace): WorldPlaceCityTier {
  if (
    place.cityTier === "capital" ||
    place.cityTier === "major" ||
    place.cityTier === "minor"
  ) {
    return place.cityTier;
  }
  if (place.kind === "capital") return "capital";
  if (place.kind === "city") return "major";
  return "minor";
}

export function placeLayerIdForTier(
  tier: WorldPlaceCityTier
): WorldPlaceLayerId {
  switch (tier) {
    case "capital":
      return PLACE_LAYER_CAPITALS;
    case "major":
      return PLACE_LAYER_MAJOR;
    case "minor":
      return PLACE_LAYER_MINOR;
    default:
      return PLACE_LAYER_MAJOR;
  }
}

export function isPlaceLabelVisibleAtZoom(zoom: number): boolean {
  if (!Number.isFinite(zoom)) return false;
  return zoom >= PLACE_LABEL_MIN_ZOOM;
}

export function isPlaceClusteringActiveAtZoom(zoom: number): boolean {
  if (!Number.isFinite(zoom)) return true;
  return zoom < PLACE_CLUSTER_MAX_ZOOM;
}

/**
 * Marker radius (logical px) by zoom + tier. Smaller than V1 foundation dots.
 */
export function placeMarkerRadiusPx(
  zoom: number,
  tier: WorldPlaceCityTier,
  selected: boolean
): number {
  const z = Number.isFinite(zoom) ? zoom : 2;
  const base = tier === "capital" ? 5.5 : tier === "major" ? 4.5 : 3.5;
  const scale = Math.min(1.65, Math.max(0.75, 0.55 + z * 0.12));
  const radius = base * scale;
  return selected ? radius * 1.35 : radius;
}

export function buildPlaceLayerControls(
  selectedLayers: WorldPlaceLayerId[],
  placesBound: boolean
): {
  layerId: WorldPlaceLayerId;
  label: string;
  enabled: boolean;
  active: boolean;
  reason: string | null;
}[] {
  return ALL_PLACE_LAYER_IDS.map((layerId) => {
    if (!placesBound) {
      return {
        layerId,
        label: PLACE_LAYER_LABELS[layerId],
        enabled: false,
        active: false,
        reason: "No place provider is connected.",
      };
    }
    return {
      layerId,
      label: PLACE_LAYER_LABELS[layerId],
      enabled: true,
      active: selectedLayers.includes(layerId),
      reason: null,
    };
  });
}

export function togglePlaceLayerSelection(
  current: WorldPlaceLayerId[],
  layerId: WorldPlaceLayerId
): WorldPlaceLayerId[] {
  if (current.includes(layerId)) {
    return current.filter((id) => id !== layerId);
  }
  return [...current, layerId];
}

export function defaultSelectedPlaceLayers(): WorldPlaceLayerId[] {
  return [...ALL_PLACE_LAYER_IDS];
}

/** Simple grid clustering for unit tests / non-MapLibre paths. */
export function clusterPlacesByZoom(
  places: Array<{ id: string; latitude: number; longitude: number }>,
  zoom: number
): Array<{ ids: string[]; latitude: number; longitude: number; count: number }> {
  if (!isPlaceClusteringActiveAtZoom(zoom)) {
    return places.map((p) => ({
      ids: [p.id],
      latitude: p.latitude,
      longitude: p.longitude,
      count: 1,
    }));
  }
  const cell = Math.max(2, 12 - zoom * 1.5);
  const buckets = new Map<
    string,
    { ids: string[]; latitude: number; longitude: number; count: number }
  >();
  for (const p of places) {
    const key = `${Math.floor(p.latitude / cell)}:${Math.floor(p.longitude / cell)}`;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        ids: [p.id],
        latitude: p.latitude,
        longitude: p.longitude,
        count: 1,
      });
    } else {
      existing.ids.push(p.id);
      existing.count += 1;
      existing.latitude =
        (existing.latitude * (existing.count - 1) + p.latitude) / existing.count;
      existing.longitude =
        (existing.longitude * (existing.count - 1) + p.longitude) /
        existing.count;
    }
  }
  return Array.from(buckets.values());
}
