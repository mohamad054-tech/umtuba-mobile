import { useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import {
  PLACE_CLUSTER_MAX_ZOOM,
  PLACE_LABEL_MIN_ZOOM,
  placesMarkersToGeoJSON,
} from "@/src/lib/world/places";
import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import { colors } from "@/src/theme/colors";

type MapLibrePlacesLayerProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Professional Places layer: clustered GeoJSON + zoom-scaled circles + labels.
 * Renderer-only — UI never imports this or @maplibre/*.
 */
export function MapLibrePlacesLayer({ adapter }: MapLibrePlacesLayerProps) {
  const markers = adapter.getPlaceMarkers();
  const selectedId = adapter.getSelectedPlaceMarkerId();
  const zoom = adapter.getSessionCamera().zoom;

  const geojson = useMemo(
    () => placesMarkersToGeoJSON(markers, selectedId),
    [markers, selectedId]
  );

  if (markers.length === 0) {
    return null;
  }

  const showLabels = zoom >= PLACE_LABEL_MIN_ZOOM;

  return (
    <GeoJSONSource
      id="world-places-source"
      data={geojson}
      cluster
      clusterRadius={42}
      clusterMaxZoom={PLACE_CLUSTER_MAX_ZOOM}
      clusterMinPoints={2}
      onPress={(event) => {
        const feature = event.nativeEvent?.features?.[0];
        if (!feature) return;
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        if (props.cluster) {
          const coords = (feature.geometry as GeoJSON.Point | undefined)
            ?.coordinates;
          if (coords && coords.length >= 2) {
            adapter.focusPlaceAt(
              coords[1],
              coords[0],
              PLACE_CLUSTER_MAX_ZOOM + 1.2
            );
          }
          return;
        }
        const id =
          typeof props.id === "string"
            ? props.id
            : typeof feature.id === "string"
              ? feature.id
              : null;
        if (id) adapter.reportPlacePress(id);
      }}
    >
      <Layer
        id="world-places-clusters"
        type="circle"
        filter={["has", "point_count"]}
        style={{
          circleColor: colors.accentCyan,
          circleOpacity: 0.88,
          circleStrokeWidth: 2,
          circleStrokeColor: colors.bg,
          circleRadius: ["step", ["get", "point_count"], 12, 4, 15, 8, 18],
        }}
      />
      <Layer
        id="world-places-cluster-count"
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
        id="world-places-points"
        type="circle"
        filter={["!", ["has", "point_count"]]}
        style={{
          circleColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.text,
            [
              "match",
              ["get", "cityTier"],
              "capital",
              colors.accentCyan,
              "major",
              "#67e8f9",
              colors.accentViolet,
            ],
          ],
          circleStrokeWidth: [
            "case",
            ["==", ["get", "selected"], 1],
            2.5,
            1.5,
          ],
          circleStrokeColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.accentCyan,
            colors.bg,
          ],
          circleOpacity: 0.95,
          circleRadius: [
            "interpolate",
            ["linear"],
            ["zoom"],
            1,
            [
              "case",
              ["==", ["get", "selected"], 1],
              5,
              ["match", ["get", "cityTier"], "capital", 4, "major", 3.5, 3],
            ],
            6,
            [
              "case",
              ["==", ["get", "selected"], 1],
              8,
              [
                "match",
                ["get", "cityTier"],
                "capital",
                6.5,
                "major",
                5.5,
                4.5,
              ],
            ],
            12,
            [
              "case",
              ["==", ["get", "selected"], 1],
              10,
              ["match", ["get", "cityTier"], "capital", 8, "major", 7, 5.5],
            ],
          ],
        }}
      />
      {showLabels ? (
        <Layer
          id="world-places-labels"
          type="symbol"
          filter={["!", ["has", "point_count"]]}
          minzoom={PLACE_LABEL_MIN_ZOOM}
          style={{
            textField: ["get", "name"],
            textSize: 11,
            textColor: colors.text,
            textHaloColor: colors.bg,
            textHaloWidth: 1.2,
            textOffset: [0, 1.15],
            textAnchor: "top",
            textOptional: true,
            textAllowOverlap: false,
            symbolSortKey: [
              "match",
              ["get", "cityTier"],
              "capital",
              1,
              "major",
              2,
              3,
            ],
          }}
        />
      ) : null}
    </GeoJSONSource>
  );
}
