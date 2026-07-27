import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

export const SATELLITE_MAP_SOURCE_ID = "world-map-source-satellite" as const;

export const SATELLITE_MAP_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

const SATELLITE_MAP_STYLE = {
  version: 8,
  name: "UM World Satellite",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: SATELLITE_MAP_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [{ id: "esri-satellite", type: "raster", source: "esri" }],
} as const;

/** Inline MapLibre style encoded as data URI — owned by MapSource, not renderer. */
export const SATELLITE_MAP_STYLE_URL = `data:application/json,${encodeURIComponent(
  JSON.stringify(SATELLITE_MAP_STYLE)
)}`;

export function createSatelliteMapSource(): WorldMapSource {
  return {
    id: SATELLITE_MAP_SOURCE_ID,
    kind: "satellite",
    label: "Satellite",
    isAvailable(): boolean {
      return true;
    },
    getStyleUrl(): string | null {
      return SATELLITE_MAP_STYLE_URL;
    },
    getAttribution(): string {
      return SATELLITE_MAP_ATTRIBUTION;
    },
  };
}

/** Alias for SatelliteSourceProvider naming. */
export const createSatelliteSourceProvider = createSatelliteMapSource;
