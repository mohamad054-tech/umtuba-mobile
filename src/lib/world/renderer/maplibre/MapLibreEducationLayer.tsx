import { useMemo } from "react";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

import { educationMarkersToGeoJSON } from "@/src/lib/world/education";
import { PLACE_LABEL_MIN_ZOOM } from "@/src/lib/world/places";
import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import { colors } from "@/src/theme/colors";

type MapLibreEducationLayerProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Education layer — violet square markers, visually distinct from cyan city circles.
 * Renderer-only — UI never imports this or @maplibre/*.
 */
export function MapLibreEducationLayer({
  adapter,
}: MapLibreEducationLayerProps) {
  const markers = adapter.getEducationMarkers();
  const selectedId = adapter.getSelectedEducationMarkerId();
  const zoom = adapter.getSessionCamera().zoom;

  const geojson = useMemo(
    () => educationMarkersToGeoJSON(markers, selectedId),
    [markers, selectedId]
  );

  if (markers.length === 0) {
    return null;
  }

  const showLabels = zoom >= PLACE_LABEL_MIN_ZOOM;

  return (
    <GeoJSONSource
      id="world-education-source"
      data={geojson}
      onPress={(event) => {
        const feature = event.nativeEvent?.features?.[0];
        if (!feature) return;
        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const id =
          typeof props.id === "string"
            ? props.id
            : typeof feature.id === "string"
              ? feature.id
              : null;
        if (id) adapter.reportEducationPress(id);
      }}
    >
      <Layer
        id="world-education-points"
        type="circle"
        style={{
          // Squarer look via stroke + type-scaled radius (distinct from city dots).
          circleColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.text,
            colors.accentViolet,
          ],
          circleOpacity: 0.95,
          circleStrokeWidth: [
            "case",
            ["==", ["get", "selected"], 1],
            3,
            2,
          ],
          circleStrokeColor: [
            "case",
            ["==", ["get", "selected"], 1],
            colors.accentViolet,
            colors.bg,
          ],
          circleRadius: [
            "interpolate",
            ["linear"],
            ["zoom"],
            2,
            [
              "match",
              ["get", "educationType"],
              "university",
              5,
              "school",
              4,
              3.5,
            ],
            6,
            [
              "match",
              ["get", "educationType"],
              "university",
              9,
              "school",
              7.5,
              6.5,
            ],
            10,
            [
              "match",
              ["get", "educationType"],
              "university",
              12,
              "school",
              10,
              9,
            ],
          ],
        }}
      />
      {showLabels ? (
        <Layer
          id="world-education-labels"
          type="symbol"
          minzoom={PLACE_LABEL_MIN_ZOOM}
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
