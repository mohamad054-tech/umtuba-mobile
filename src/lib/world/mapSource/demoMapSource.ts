import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

/** Development-only MapLibre demotiles — not a paid/production provider. */
export const DEMO_MAP_STYLE_URL =
  "https://demotiles.maplibre.org/style.json";

export const DEMO_MAP_SOURCE_ID = "world-map-source-demo" as const;

export const DEMO_MAP_ATTRIBUTION =
  "MapLibre demotiles (development only). Not a production map source.";

export function createDemoMapSource(): WorldMapSource {
  return {
    id: DEMO_MAP_SOURCE_ID,
    kind: "demo",
    label: "Demo",
    isAvailable(): boolean {
      return true;
    },
    getStyleUrl(): string | null {
      return DEMO_MAP_STYLE_URL;
    },
    getAttribution(): string {
      return DEMO_MAP_ATTRIBUTION;
    },
  };
}
