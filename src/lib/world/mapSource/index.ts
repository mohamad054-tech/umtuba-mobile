export type {
  WorldMapSource,
  WorldMapSourceKind,
} from "@/src/lib/world/mapSource/types";
export { isWorldMapSourceAvailable } from "@/src/lib/world/mapSource/types";
export {
  createDemoMapSource,
  DEMO_MAP_ATTRIBUTION,
  DEMO_MAP_SOURCE_ID,
  DEMO_MAP_STYLE_URL,
} from "@/src/lib/world/mapSource/demoMapSource";
export {
  createStreetMapSource,
  STREET_MAP_ATTRIBUTION,
  STREET_MAP_SOURCE_ID,
  STREET_MAP_STYLE_URL,
} from "@/src/lib/world/mapSource/streetMapSource";
export {
  createSatelliteMapSource,
  createSatelliteSourceProvider,
  SATELLITE_MAP_ATTRIBUTION,
  SATELLITE_MAP_SOURCE_ID,
  SATELLITE_MAP_STYLE_URL,
} from "@/src/lib/world/mapSource/satelliteMapSource";
export {
  createTerrainMapSource,
  TERRAIN_MAP_SOURCE_ID,
} from "@/src/lib/world/mapSource/terrainMapSource";
export {
  createDefaultMapSourceRegistry,
  createMapSourceRegistry,
  type MapSourceRegistry,
} from "@/src/lib/world/mapSource/registry";
