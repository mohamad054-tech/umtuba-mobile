import { useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import {
  commerceMarkersToGeoJSON,
  COMMERCE_CLUSTER_MAX_ZOOM,
} from "@/src/lib/world/commerce";
import { PLACE_LABEL_MIN_ZOOM } from "@/src/lib/world/places";
import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import { colors } from "@/src/theme/colors";

type MapLibreCommerceLayerProps = {
  adapter: MapLibreRendererAdapter;
};

export function MapLibreCommerceLayer({ adapter }: MapLibreCommerceLayerProps) {
  const markers = adapter.getCommerceMarkers();
  const selectedId = adapter.getSelectedCommerceMarkerId();
  const zoom = adapter.getSessionCamera().zoom;

  const geojson = useMemo(
    () => commerceMarkersToGeoJSON(markers, selectedId),
    [markers, selectedId]
  );

  if (markers.length === 0) return null;
  const showLabels = zoom >= PLACE_LABEL_MIN_ZOOM;

  return (
    <GeoJSONSource
      id="world-commerce-source"
      data={geojson}
      cluster
      clusterRadius={52}
      clusterMaxZoom={COMMERCE_CLUSTER_MAX_ZOOM}
      clusterMinPoints={2}
      onPress={(event) => {
        const feature = event.nativeEvent?.features?.[0];
        if (!feature) return;
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        if (props.cluster) {
          const coords = (feature.geometry as GeoJSON.Point | undefined)?.coordinates;
          if (coords && coords.length >= 2) {
            adapter.focusPlaceAt(coords[1], coords[0], COMMERCE_CLUSTER_MAX_ZOOM + 1.2);
          }
          return;
        }
        const id =
          typeof props.id === "string"
            ? props.id
            : typeof feature.id === "string"
              ? feature.id
              : null;
        if (id) adapter.reportCommercePress(id);
      }}
    >
      <Layer
        id="world-commerce-clusters"
        type="circle"
        filter={["has", "point_count"]}
        style={{
          circleColor: colors.danger,
          circleOpacity: 0.85,
          circleStrokeWidth: 2,
          circleStrokeColor: colors.text,
          circleRadius: ["step", ["get", "point_count"], 14, 5, 17, 10, 20],
        }}
      />
      <Layer
        id="world-commerce-cluster-count"
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
        id="world-commerce-points"
        type="circle"
        filter={["!", ["has", "point_count"]]}
        style={{
          circleColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.text,
            colors.danger,
          ],
          circleStrokeWidth: ["case", ["==", ["get", "selected"], 1], 3, 2],
          circleStrokeColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.danger,
            colors.text,
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
      {showLabels ? (
        <Layer
          id="world-commerce-labels"
          type="symbol"
          minzoom={PLACE_LABEL_MIN_ZOOM}
          filter={["!", ["has", "point_count"]]}
          style={{
            textField: ["get", "name"],
            textSize: 11,
            textColor: colors.text,
            textHaloColor: colors.bg,
            textHaloWidth: 1.2,
            textOffset: [0, 1.35],
            textAnchor: "top",
            textMaxWidth: 10,
            textOptional: true,
          }}
        />
      ) : null}
    </GeoJSONSource>
  );
}
