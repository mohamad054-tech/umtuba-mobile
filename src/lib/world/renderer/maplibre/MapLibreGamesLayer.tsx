import { useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import {
  gamesMarkersToGeoJSON,
  GAME_CLUSTER_MAX_ZOOM,
} from "@/src/lib/world/games";
import { PLACE_LABEL_MIN_ZOOM } from "@/src/lib/world/places";
import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import {
  getCachedGeoJSON,
  markersSignature,
} from "@/src/lib/world/renderer/maplibre/layerCache";
import { colors } from "@/src/theme/colors";

type MapLibreGamesLayerProps = {
  adapter: MapLibreRendererAdapter;
  surfaceRevision: number;
};

const GAMES_CACHE_KEY = "world-games";

export function MapLibreGamesLayer({
  adapter,
  surfaceRevision,
}: MapLibreGamesLayerProps) {
  const markers = adapter.getGameMarkers();
  const selectedId = adapter.getSelectedGameMarkerId();

  const geojson = useMemo(() => {
    const signature = markersSignature(markers, selectedId);
    return getCachedGeoJSON(GAMES_CACHE_KEY, signature, () =>
      gamesMarkersToGeoJSON(markers, selectedId)
    );
  }, [markers, selectedId, surfaceRevision]);

  if (markers.length === 0) return null;

  return (
    <GeoJSONSource
      id="world-games-source"
      data={geojson}
      cluster
      clusterRadius={52}
      clusterMaxZoom={GAME_CLUSTER_MAX_ZOOM}
      clusterMinPoints={2}
      onPress={(event) => {
        const feature = event.nativeEvent?.features?.[0];
        if (!feature) return;
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        if (props.cluster) {
          const coords = (feature.geometry as GeoJSON.Point | undefined)?.coordinates;
          if (coords && coords.length >= 2) {
            adapter.focusPlaceAt(coords[1], coords[0], GAME_CLUSTER_MAX_ZOOM + 1.2);
          }
          return;
        }
        const id =
          typeof props.id === "string"
            ? props.id
            : typeof feature.id === "string"
              ? feature.id
              : null;
        if (id) adapter.reportGamePress(id);
      }}
    >
      <Layer
        id="world-games-clusters"
        type="circle"
        filter={["has", "point_count"]}
        style={{
          circleColor: colors.accentCyan,
          circleOpacity: [
            "interpolate",
            ["linear"],
            ["zoom"],
            GAME_CLUSTER_MAX_ZOOM - 0.4,
            0.7,
            GAME_CLUSTER_MAX_ZOOM + 0.5,
            0.88,
          ],
          circleStrokeWidth: 2,
          circleStrokeColor: colors.accentViolet,
          circleRadius: ["step", ["get", "point_count"], 14, 5, 17, 10, 20],
        }}
      />
      <Layer
        id="world-games-cluster-count"
        type="symbol"
        filter={["has", "point_count"]}
        style={{
          textField: ["get", "point_count_abbreviated"],
          textSize: 11,
          textColor: colors.bg,
          textAllowOverlap: true,
        }}
      />
      <Layer
        id="world-games-points"
        type="circle"
        filter={["!", ["has", "point_count"]]}
        style={{
          circleColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.text,
            colors.accentCyan,
          ],
          circleStrokeWidth: ["case", ["==", ["get", "selected"], 1], 3, 2],
          circleStrokeColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.accentCyan,
            colors.accentViolet,
          ],
          circleRadius: [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            5,
            6,
            9,
            10,
            12,
          ],
        }}
      />
      <Layer
        id="world-games-labels"
        type="symbol"
        minzoom={PLACE_LABEL_MIN_ZOOM}
        filter={["!", ["has", "point_count"]]}
        style={{
          textField: ["get", "gameName"],
          textSize: 11,
          textColor: colors.text,
          textHaloColor: colors.bg,
          textHaloWidth: 1.2,
          textOffset: [0, 1.35],
          textAnchor: "top",
          textMaxWidth: 10,
          textOptional: true,
          textAllowOverlap: false,
        }}
      />
    </GeoJSONSource>
  );
}
