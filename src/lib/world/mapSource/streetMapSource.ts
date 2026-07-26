import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

export const STREET_MAP_SOURCE_ID = "world-map-source-street" as const;

/** Placeholder — no street tile provider bound yet. */
export function createStreetMapSource(): WorldMapSource {
  return {
    id: STREET_MAP_SOURCE_ID,
    kind: "street",
    label: "Street",
    isAvailable(): boolean {
      return false;
    },
    getStyleUrl(): string | null {
      return null;
    },
    getAttribution(): string {
      return "Street map source is not configured.";
    },
  };
}
