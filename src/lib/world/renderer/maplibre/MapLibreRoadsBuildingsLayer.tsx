import { Layer, VectorSource } from "@maplibre/maplibre-react-native";

import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import {
  openMapTilesClassFilter,
  resolveBuildingsVisibility,
  resolveRoadClassVisibility,
} from "@/src/lib/world/renderer/maplibre/roadsBuildings";

type MapLibreRoadsBuildingsLayerProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Roads & buildings vector overlay — renderer-only.
 * Tile URLs come from MapSource via Runtime → adapter (never hardcoded here).
 */
export function MapLibreRoadsBuildingsLayer({
  adapter,
}: MapLibreRoadsBuildingsLayerProps) {
  const overlay = adapter.getVectorOverlay();
  if (!overlay || !Array.isArray(overlay.tiles) || overlay.tiles.length === 0) {
    return null;
  }

  const caps = adapter.getCapabilities();
  const experience = adapter.getBasemapExperience();
  const roadDetail = adapter.getRoadDetail();
  const buildingsMode = adapter.getEffectiveBuildingsMode();
  const zoom = adapter.getSessionCamera().zoom;
  const roads = resolveRoadClassVisibility(roadDetail, zoom);
  const buildings = resolveBuildingsVisibility({
    preference: buildingsMode,
    zoom,
    rendererSupportsBuildings: caps.supportsBuildings,
    rendererSupports3D: caps.supports3D,
    sourceSupports2d: experience.supportsBuildings2d,
    sourceSupports3d: experience.supportsBuildings3d,
  });

  const showRoadOverlay = experience.supportsRoadDetail && !experience.basemapIncludesRoads;
  const showBuilding2d =
    buildings.fill2d &&
    experience.supportsBuildings2d &&
    !experience.basemapIncludesBuildings;
  const showBuilding3d =
    buildings.extrusion3d && experience.supportsBuildings3d;

  if (!showRoadOverlay && !showBuilding2d && !showBuilding3d) {
    return null;
  }

  const highwayFilter = openMapTilesClassFilter("highway") as never;
  const primaryFilter = openMapTilesClassFilter("primary") as never;
  const secondaryFilter = openMapTilesClassFilter("secondary") as never;
  const localFilter = openMapTilesClassFilter("local") as never;

  return (
    <VectorSource
      id="world-roads-buildings-source"
      tiles={overlay.tiles}
      minzoom={overlay.minzoom}
      maxzoom={overlay.maxzoom}
      attribution={overlay.attribution}
    >
      {showRoadOverlay && roads.highway ? (
        <Layer
          id="world-roads-highway"
          type="line"
          source-layer="transportation"
          filter={highwayFilter}
          style={{
            lineColor: "#f5c542",
            lineWidth: ["interpolate", ["linear"], ["zoom"], 4, 1.2, 12, 4.5],
            lineOpacity: 0.92,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ) : null}
      {showRoadOverlay && roads.primary ? (
        <Layer
          id="world-roads-primary"
          type="line"
          source-layer="transportation"
          filter={primaryFilter}
          style={{
            lineColor: "#ffe08a",
            lineWidth: ["interpolate", ["linear"], ["zoom"], 5, 0.9, 14, 3.2],
            lineOpacity: 0.88,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ) : null}
      {showRoadOverlay && roads.secondary ? (
        <Layer
          id="world-roads-secondary"
          type="line"
          source-layer="transportation"
          filter={secondaryFilter}
          style={{
            lineColor: "#ffffff",
            lineWidth: ["interpolate", ["linear"], ["zoom"], 8, 0.7, 15, 2.4],
            lineOpacity: 0.78,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ) : null}
      {showRoadOverlay && roads.local ? (
        <Layer
          id="world-roads-local"
          type="line"
          source-layer="transportation"
          filter={localFilter}
          style={{
            lineColor: "#d7dde8",
            lineWidth: ["interpolate", ["linear"], ["zoom"], 12, 0.5, 16, 1.6],
            lineOpacity: 0.65,
            lineCap: "round",
            lineJoin: "round",
          }}
        />
      ) : null}
      {showRoadOverlay && roads.roadLabels ? (
        <Layer
          id="world-roads-labels"
          type="symbol"
          source-layer="transportation_name"
          minzoom={ROAD_LABEL_PROXY_MIN}
          style={{
            textField: ["coalesce", ["get", "name"], ["get", "ref"]],
            textSize: ["interpolate", ["linear"], ["zoom"], 10, 10, 16, 13],
            textColor: "#f4f7fb",
            textHaloColor: "rgba(8,12,20,0.75)",
            textHaloWidth: 1.2,
            symbolPlacement: "line",
            textMaxAngle: 30,
            textOptional: true,
            textAllowOverlap: false,
          }}
        />
      ) : null}
      {showBuilding2d ? (
        <Layer
          id="world-buildings-2d"
          type="fill"
          source-layer="building"
          minzoom={14}
          style={{
            fillColor: "rgba(180, 190, 210, 0.45)",
            fillOutlineColor: "rgba(120, 130, 150, 0.55)",
            fillOpacity: 0.7,
          }}
        />
      ) : null}
      {showBuilding3d ? (
        <Layer
          id="world-buildings-3d"
          type="fill-extrusion"
          source-layer="building"
          minzoom={15}
          style={{
            fillExtrusionColor: "rgba(170, 180, 200, 0.85)",
            fillExtrusionHeight: [
              "coalesce",
              ["get", "render_height"],
              ["get", "height"],
              12,
            ],
            fillExtrusionBase: [
              "coalesce",
              ["get", "render_min_height"],
              ["get", "min_height"],
              0,
            ],
            fillExtrusionOpacity: 0.78,
          }}
        />
      ) : null}
    </VectorSource>
  );
}

/** Labels only when resolveRoadClassVisibility says so; minzoom soft floor. */
const ROAD_LABEL_PROXY_MIN = 9;
