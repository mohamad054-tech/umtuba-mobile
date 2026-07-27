/**
 * Roads & Buildings display policy — zoom / detail / capability gating.
 * Pure functions; no MapLibre imports.
 */

export type WorldRoadDetail = "low" | "medium" | "high";
export type WorldBuildingsMode = "off" | "2d" | "3d";
export type WorldRoadClass = "highway" | "primary" | "secondary" | "local";

export type RoadClassVisibility = {
  highway: boolean;
  primary: boolean;
  secondary: boolean;
  local: boolean;
  roadLabels: boolean;
};

export type BuildingsVisibility = {
  fill2d: boolean;
  extrusion3d: boolean;
};

/** Min zooms — hide heavy detail when far out. */
export const ROAD_CLASS_MIN_ZOOM: Record<
  WorldRoadClass,
  Record<WorldRoadDetail, number>
> = {
  highway: { low: 3, medium: 3, high: 2 },
  primary: { low: 7, medium: 5, high: 4 },
  secondary: { low: 11, medium: 8, high: 7 },
  local: { low: 16, medium: 13, high: 11 },
};

export const ROAD_LABEL_MIN_ZOOM: Record<WorldRoadDetail, number> = {
  low: 14,
  medium: 11,
  high: 9,
};

export const BUILDINGS_2D_MIN_ZOOM = 14;
export const BUILDINGS_3D_MIN_ZOOM = 15;

const HIGHWAY_CLASSES = ["motorway", "trunk"] as const;
const PRIMARY_CLASSES = ["primary"] as const;
const SECONDARY_CLASSES = ["secondary", "tertiary"] as const;
const LOCAL_CLASSES = ["minor", "service", "path", "track"] as const;

export function isWorldRoadDetail(value: unknown): value is WorldRoadDetail {
  return value === "low" || value === "medium" || value === "high";
}

export function isWorldBuildingsMode(value: unknown): value is WorldBuildingsMode {
  return value === "off" || value === "2d" || value === "3d";
}

export function resolveRoadClassVisibility(
  detail: WorldRoadDetail,
  zoom: number
): RoadClassVisibility {
  const z = typeof zoom === "number" && Number.isFinite(zoom) ? zoom : 0;
  return {
    highway: z >= ROAD_CLASS_MIN_ZOOM.highway[detail],
    primary: z >= ROAD_CLASS_MIN_ZOOM.primary[detail],
    secondary: z >= ROAD_CLASS_MIN_ZOOM.secondary[detail],
    local: z >= ROAD_CLASS_MIN_ZOOM.local[detail],
    roadLabels: z >= ROAD_LABEL_MIN_ZOOM[detail],
  };
}

export function resolveBuildingsVisibility(options: {
  preference: WorldBuildingsMode;
  zoom: number;
  rendererSupportsBuildings: boolean;
  rendererSupports3D: boolean;
  sourceSupports2d: boolean;
  sourceSupports3d: boolean;
}): BuildingsVisibility {
  const z =
    typeof options.zoom === "number" && Number.isFinite(options.zoom)
      ? options.zoom
      : 0;

  if (!options.rendererSupportsBuildings || options.preference === "off") {
    return { fill2d: false, extrusion3d: false };
  }

  if (options.preference === "3d") {
    if (
      options.rendererSupports3D &&
      options.sourceSupports3d &&
      z >= BUILDINGS_3D_MIN_ZOOM
    ) {
      return { fill2d: false, extrusion3d: true };
    }
    // Fail-closed to 2D when 3D unavailable.
    if (options.sourceSupports2d && z >= BUILDINGS_2D_MIN_ZOOM) {
      return { fill2d: true, extrusion3d: false };
    }
    return { fill2d: false, extrusion3d: false };
  }

  // preference === "2d"
  if (options.sourceSupports2d && z >= BUILDINGS_2D_MIN_ZOOM) {
    return { fill2d: true, extrusion3d: false };
  }
  return { fill2d: false, extrusion3d: false };
}

/**
 * Resolve effective buildings preference after capability gating.
 * Never returns 3d when unsupported; never crashes.
 */
export function resolveEffectiveBuildingsMode(options: {
  preference: WorldBuildingsMode;
  rendererSupportsBuildings: boolean;
  rendererSupports3D: boolean;
  sourceSupports2d: boolean;
  sourceSupports3d: boolean;
}): WorldBuildingsMode {
  if (!options.rendererSupportsBuildings || options.preference === "off") {
    return "off";
  }
  if (options.preference === "3d") {
    if (options.rendererSupports3D && options.sourceSupports3d) return "3d";
    if (options.sourceSupports2d) return "2d";
    return "off";
  }
  if (options.sourceSupports2d) return "2d";
  return "off";
}

export function openMapTilesClassFilter(
  roadClass: WorldRoadClass
): unknown[] {
  const classes =
    roadClass === "highway"
      ? HIGHWAY_CLASSES
      : roadClass === "primary"
        ? PRIMARY_CLASSES
        : roadClass === "secondary"
          ? SECONDARY_CLASSES
          : LOCAL_CLASSES;
  return ["match", ["get", "class"], [...classes], true, false];
}
