import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

export const SATELLITE_MAP_SOURCE_ID = "world-map-source-satellite" as const;

/** Placeholder — no satellite tile provider bound yet. */
export function createSatelliteMapSource(): WorldMapSource {
  return {
    id: SATELLITE_MAP_SOURCE_ID,
    kind: "satellite",
    label: "Satellite",
    isAvailable(): boolean {
      return false;
    },
    getStyleUrl(): string | null {
      return null;
    },
    getAttribution(): string {
      return "Satellite map source is not configured.";
    },
  };
}
