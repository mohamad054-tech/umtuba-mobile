import { useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import { PLACE_LABEL_MIN_ZOOM } from "@/src/lib/world/places";
import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import {
  USER_CLUSTER_MAX_ZOOM,
  usersMarkersToGeoJSON,
} from "@/src/lib/world/users";
import { colors } from "@/src/theme/colors";

type MapLibreUsersLayerProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Users layer — clustered green markers with initial labels.
 * Approximate pins only; renderer never invents coordinates.
 */
export function MapLibreUsersLayer({ adapter }: MapLibreUsersLayerProps) {
  const markers = adapter.getUserMarkers();
  const selectedId = adapter.getSelectedUserMarkerId();
  const zoom = adapter.getSessionCamera().zoom;

  const geojson = useMemo(
    () => usersMarkersToGeoJSON(markers, selectedId),
    [markers, selectedId]
  );

  if (markers.length === 0) {
    return null;
  }

  const showLabels = zoom >= PLACE_LABEL_MIN_ZOOM;

  return (
    <GeoJSONSource
      id="world-users-source"
      data={geojson}
      cluster
      clusterRadius={48}
      clusterMaxZoom={USER_CLUSTER_MAX_ZOOM}
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
              USER_CLUSTER_MAX_ZOOM + 1.2
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
        if (id) adapter.reportUserPress(id);
      }}
    >
      <Layer
        id="world-users-clusters"
        type="circle"
        filter={["has", "point_count"]}
        style={{
          circleColor: colors.success,
          circleOpacity: 0.82,
          circleStrokeWidth: 2,
          circleStrokeColor: colors.bg,
          // Soft-size clusters — avoid implying precise density.
          circleRadius: ["step", ["get", "point_count"], 14, 5, 17, 10, 20],
        }}
      />
      <Layer
        id="world-users-cluster-count"
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
        id="world-users-points"
        type="circle"
        filter={["!", ["has", "point_count"]]}
        style={{
          circleColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.text,
            colors.success,
          ],
          circleOpacity: 0.95,
          circleStrokeWidth: ["case", ["==", ["get", "selected"], 1], 3, 2],
          circleStrokeColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.success,
            colors.bg,
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
        id="world-users-initials"
        type="symbol"
        filter={["!", ["has", "point_count"]]}
        style={{
          textField: ["get", "initial"],
          textSize: 11,
          textColor: colors.bg,
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
      {showLabels ? (
        <Layer
          id="world-users-labels"
          type="symbol"
          minzoom={PLACE_LABEL_MIN_ZOOM}
          filter={["!", ["has", "point_count"]]}
          style={{
            textField: ["get", "displayName"],
            textSize: 11,
            textColor: colors.text,
            textHaloColor: colors.bg,
            textHaloWidth: 1.2,
            textOffset: [0, 1.4],
            textAnchor: "top",
            textMaxWidth: 8,
            textOptional: true,
          }}
        />
      ) : null}
    </GeoJSONSource>
  );
}
