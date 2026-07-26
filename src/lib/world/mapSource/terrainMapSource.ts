import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

export const TERRAIN_MAP_SOURCE_ID = "world-map-source-terrain" as const;

/** Placeholder — no terrain tile provider bound yet. */
export function createTerrainMapSource(): WorldMapSource {
  return {
    id: TERRAIN_MAP_SOURCE_ID,
    kind: "terrain",
    label: "Terrain",
    isAvailable(): boolean {
      return false;
    },
    getStyleUrl(): string | null {
      return null;
    },
    getAttribution(): string {
      return "Terrain map source is not configured.";
    },
  };
}
