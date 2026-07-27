/**
 * Map-source basemap experience — roads / buildings overlays.
 * Tile URLs live here (MapSource), never hardcoded in the renderer.
 */

import type { WorldMapSourceKind } from "@/src/lib/world/mapSource/types";

/** OpenFreeMap / OpenMapTiles vector planet — owned by MapSource, not renderer. */
export const OPENFREEMAP_VECTOR_TILES_URL =
  "https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf";

export const OPENFREEMAP_VECTOR_ATTRIBUTION =
  "© OpenFreeMap © OpenMapTiles Data from OpenStreetMap";

export type WorldVectorOverlaySpec = {
  tiles: string[];
  attribution: string;
  minzoom?: number;
  maxzoom?: number;
};

export type WorldMapSourceExperience = {
  supportsRoadDetail: boolean;
  supportsBuildings2d: boolean;
  supportsBuildings3d: boolean;
  /** Liberty / street styles already paint roads — skip duplicate road overlays. */
  basemapIncludesRoads: boolean;
  /** Liberty already paints 2D buildings — skip duplicate 2D fills. */
  basemapIncludesBuildings: boolean;
  getVectorOverlay(): WorldVectorOverlaySpec | null;
};

export function createEmptyMapSourceExperience(): WorldMapSourceExperience {
  return {
    supportsRoadDetail: false,
    supportsBuildings2d: false,
    supportsBuildings3d: false,
    basemapIncludesRoads: false,
    basemapIncludesBuildings: false,
    getVectorOverlay(): WorldVectorOverlaySpec | null {
      return null;
    },
  };
}

function openFreeMapOverlay(): WorldVectorOverlaySpec {
  return {
    tiles: [OPENFREEMAP_VECTOR_TILES_URL],
    attribution: OPENFREEMAP_VECTOR_ATTRIBUTION,
    minzoom: 0,
    maxzoom: 14,
  };
}

/** Streets (OpenFreeMap liberty): richest basemap roads; overlay mainly for 3D buildings. */
export function createStreetMapSourceExperience(): WorldMapSourceExperience {
  return {
    supportsRoadDetail: true,
    supportsBuildings2d: true,
    supportsBuildings3d: true,
    basemapIncludesRoads: true,
    basemapIncludesBuildings: true,
    getVectorOverlay(): WorldVectorOverlaySpec | null {
      return openFreeMapOverlay();
    },
  };
}

/** Satellite raster + vector road/label/building overlays. */
export function createSatelliteMapSourceExperience(): WorldMapSourceExperience {
  return {
    supportsRoadDetail: true,
    supportsBuildings2d: true,
    supportsBuildings3d: true,
    basemapIncludesRoads: false,
    basemapIncludesBuildings: false,
    getVectorOverlay(): WorldVectorOverlaySpec | null {
      return openFreeMapOverlay();
    },
  };
}

/** Terrain topo raster + clear road overlays (no heavy local detail at far zoom). */
export function createTerrainMapSourceExperience(): WorldMapSourceExperience {
  return {
    supportsRoadDetail: true,
    supportsBuildings2d: true,
    supportsBuildings3d: false,
    basemapIncludesRoads: false,
    basemapIncludesBuildings: false,
    getVectorOverlay(): WorldVectorOverlaySpec | null {
      return openFreeMapOverlay();
    },
  };
}

export function createDemoMapSourceExperience(): WorldMapSourceExperience {
  return createEmptyMapSourceExperience();
}

export function mapSourceExperienceForKind(
  kind: WorldMapSourceKind
): WorldMapSourceExperience {
  switch (kind) {
    case "street":
      return createStreetMapSourceExperience();
    case "satellite":
      return createSatelliteMapSourceExperience();
    case "terrain":
      return createTerrainMapSourceExperience();
    case "demo":
    default:
      return createDemoMapSourceExperience();
  }
}
