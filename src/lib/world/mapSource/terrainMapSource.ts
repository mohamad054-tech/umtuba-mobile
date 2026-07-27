import type { WorldMapSource } from "@/src/lib/world/mapSource/types";

export const TERRAIN_MAP_SOURCE_ID = "world-map-source-terrain" as const;

export const TERRAIN_MAP_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community";

const TERRAIN_MAP_STYLE = {
  version: 8,
  name: "UM World Terrain",
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: TERRAIN_MAP_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [{ id: "esri-terrain", type: "raster", source: "esri" }],
} as const;

/** Inline MapLibre style encoded as data URI — owned by MapSource, not renderer. */
export const TERRAIN_MAP_STYLE_URL = `data:application/json,${encodeURIComponent(
  JSON.stringify(TERRAIN_MAP_STYLE)
)}`;

export function createTerrainMapSource(): WorldMapSource {
  return {
    id: TERRAIN_MAP_SOURCE_ID,
    kind: "terrain",
    label: "Terrain",
    isAvailable(): boolean {
      return true;
    },
    getStyleUrl(): string | null {
      return TERRAIN_MAP_STYLE_URL;
    },
    getAttribution(): string {
      return TERRAIN_MAP_ATTRIBUTION;
    },
  };
}

/** Alias for TerrainSourceProvider naming. */
export const createTerrainSourceProvider = createTerrainMapSource;
