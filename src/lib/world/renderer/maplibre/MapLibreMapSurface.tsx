import { useEffect, useMemo, useReducer } from "react";
import { StyleSheet, View } from "react-native";
import { Camera, Map } from "@maplibre/maplibre-react-native";

import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";

type MapLibreMapSurfaceProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Internal MapLibre surface — must only be imported from the renderer package.
 * World UI must not import @maplibre/* directly.
 */
export function MapLibreMapSurface({ adapter }: MapLibreMapSurfaceProps) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const revision = adapter.getCameraRevision();
  const mountGeneration = adapter.getMountGeneration();
  const styleUrl = adapter.getStyleUrl();

  useEffect(() => {
    return adapter.subscribe(() => {
      bump();
    });
  }, [adapter]);

  // Only re-apply Camera when adapter revision bumps (zoom/recenter/etc).
  // Gesture-driven sync must not rewrite Camera props (avoids pan fight).
  const programmaticCamera = useMemo(
    () => adapter.getCameraAdapter().getCamera(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision is the intentional trigger
    [adapter, revision]
  );

  const center = useMemo(
    () =>
      programmaticCamera
        ? ([programmaticCamera.longitude, programmaticCamera.latitude] as [
            number,
            number,
          ])
        : ([0, 20] as [number, number]),
    [programmaticCamera]
  );

  // Fail-closed: no style from Map Source → no MapLibre Map mount.
  if (!styleUrl) {
    return <View style={styles.fill} />;
  }

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Map
        key={`maplibre-${mountGeneration}`}
        style={styles.fill}
        mapStyle={styleUrl}
        attribution
        logo={false}
        onDidFinishLoadingMap={() => {
          adapter.reportStyleLoaded();
        }}
        onDidFailLoadingMap={() => {
          adapter.reportStyleFailed(
            "World map tiles failed to load. Retry to try again."
          );
        }}
        onRegionDidChange={(event) => {
          const payload = event.nativeEvent;
          if (!payload?.center || typeof payload.zoom !== "number") return;
          adapter.syncCameraFromMap({
            longitude: payload.center[0],
            latitude: payload.center[1],
            zoom: payload.zoom,
            bearing: payload.bearing ?? 0,
            pitch: payload.pitch ?? 0,
          });
        }}
      >
        <Camera
          key={`cam-${revision}`}
          center={center}
          zoom={programmaticCamera?.zoom ?? 1.8}
          bearing={programmaticCamera?.bearing ?? 0}
          pitch={programmaticCamera?.pitch ?? 0}
          duration={250}
        />
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
});
