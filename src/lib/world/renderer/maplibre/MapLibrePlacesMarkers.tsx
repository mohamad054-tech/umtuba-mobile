import { Pressable, StyleSheet, Text, View } from "react-native";
import { Marker } from "@maplibre/maplibre-react-native";

import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import { WORLD_PLACES_LAYER_ID } from "@/src/lib/world/places";
import { colors } from "@/src/theme/colors";

type MapLibrePlacesMarkersProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Internal Places markers — renderer package only.
 * Visibility is owned by LayerAdapter ("cities"); selection via adapter → Runtime.
 */
export function MapLibrePlacesMarkers({ adapter }: MapLibrePlacesMarkersProps) {
  const visible = adapter.getLayerAdapter().isLayerVisible(WORLD_PLACES_LAYER_ID);
  if (!visible) return null;

  const markers = adapter.getPlaceMarkers();
  const selectedId = adapter.getSelectedPlaceMarkerId();

  return (
    <>
      {markers.map((marker) => {
        const selected = selectedId === marker.id;
        return (
          <Marker
            key={marker.id}
            id={marker.id}
            lngLat={[marker.longitude, marker.latitude]}
            anchor="bottom"
            selected={selected}
            onPress={() => {
              adapter.reportPlacePress(marker.id);
            }}
          >
            <View style={styles.wrap} pointerEvents="box-none">
              <Pressable
                style={[styles.pin, selected && styles.pinSelected]}
                onPress={() => {
                  adapter.reportPlacePress(marker.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${marker.name}, ${marker.countryName}, ${marker.kindLabel}`}
              >
                <View style={[styles.dot, selected && styles.dotSelected]} />
              </Pressable>
              {selected ? (
                <View style={styles.callout} accessibilityRole="summary">
                  <Text style={styles.calloutTitle}>{marker.name}</Text>
                  <Text style={styles.calloutBody}>
                    {marker.countryName} · {marker.kindLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 4,
  },
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.accentCyan,
    alignItems: "center",
    justifyContent: "center",
  },
  pinSelected: {
    borderColor: colors.text,
    backgroundColor: colors.accentCyan,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentCyan,
  },
  dotSelected: {
    backgroundColor: colors.bg,
  },
  callout: {
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  calloutTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  calloutBody: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
