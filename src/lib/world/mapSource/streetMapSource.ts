import { createStreetMapSourceExperience } from "@/src/lib/world/mapSource/experience";
import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

export const STREET_MAP_SOURCE_ID = "world-map-source-street" as const;

export const STREET_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

export const STREET_MAP_ATTRIBUTION =
  "© OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

export function createStreetMapSource(): WorldMapSource {
  const experience = createStreetMapSourceExperience();
  return {
    id: STREET_MAP_SOURCE_ID,
    kind: "street",
    label: "Streets",
    isAvailable(): boolean {
      return true;
    },
    getStyleUrl(): string | null {
      return STREET_MAP_STYLE_URL;
    },
    getAttribution(): string {
      return STREET_MAP_ATTRIBUTION;
    },
    getExperience() {
      return experience;
    },
  };
}
