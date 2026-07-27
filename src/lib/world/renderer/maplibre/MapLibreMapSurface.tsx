import { useEffect, useMemo, useReducer } from "react";
import { StyleSheet, View } from "react-native";
import { Camera, Map } from "@maplibre/maplibre-react-native";

import {
  MAPLIBRE_CAMERA_ANIMATION_MS,
  MAPLIBRE_CAMERA_MAX_ZOOM,
  MAPLIBRE_CAMERA_MIN_ZOOM,
  MAPLIBRE_DEFAULT_CAMERA,
} from "@/src/lib/world/renderer/maplibre/cameraNavigation";
import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import { MapLibreCommerceLayer } from "@/src/lib/world/renderer/maplibre/MapLibreCommerceLayer";
import { MapLibreEducationLayer } from "@/src/lib/world/renderer/maplibre/MapLibreEducationLayer";
import { MapLibreEventsLayer } from "@/src/lib/world/renderer/maplibre/MapLibreEventsLayer";
import { MapLibreGamesLayer } from "@/src/lib/world/renderer/maplibre/MapLibreGamesLayer";
import { MapLibrePlacesLayer } from "@/src/lib/world/renderer/maplibre/MapLibrePlacesLayer";
import { MapLibreRoadsBuildingsLayer } from "@/src/lib/world/renderer/maplibre/MapLibreRoadsBuildingsLayer";
import { MapLibreUsersLayer } from "@/src/lib/world/renderer/maplibre/MapLibreUsersLayer";

type MapLibreMapSurfaceProps = {
  adapter: MapLibreRendererAdapter;
};

/**
 * Internal MapLibre surface — must only be imported from the renderer package.
 * World UI must not import @maplibre/* directly.
 */
export function MapLibreMapSurface({ adapter }: MapLibreMapSurfaceProps) {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const cameraRevision = adapter.getCameraRevision();
  const surfaceRevision = adapter.getSurfaceRevision();
  const mountGeneration = adapter.getMountGeneration();
  const styleUrl = adapter.getStyleUrl();
  const limits = adapter.getZoomLimits();

  useEffect(() => {
    return adapter.subscribe(() => {
      bump();
    });
  }, [adapter]);

  const programmaticCamera = useMemo(() => {
    return adapter.getSessionCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cameraRevision triggers programmatic moves only
  }, [adapter, cameraRevision, mountGeneration]);

  const center = useMemo(
    () =>
      [programmaticCamera.longitude, programmaticCamera.latitude] as [
        number,
        number,
      ],
    [programmaticCamera]
  );

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
        dragPan
        touchZoom
        doubleTapZoom
        doubleTapHoldZoom
        touchRotate
        touchPitch
        preferredFramesPerSecond={60}
        onDidFinishLoadingMap={() => {
          adapter.reportStyleLoaded();
        }}
        onDidFailLoadingMap={() => {
          adapter.reportStyleFailed(
            "World map tiles failed to load. Retry to try again."
          );
        }}
        onRegionIsChanging={(event) => {
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
          key={`cam-${cameraRevision}-${mountGeneration}`}
          center={center}
          zoom={programmaticCamera.zoom ?? MAPLIBRE_DEFAULT_CAMERA.zoom}
          bearing={programmaticCamera.bearing ?? 0}
          pitch={programmaticCamera.pitch ?? 0}
          minZoom={limits.minZoom ?? MAPLIBRE_CAMERA_MIN_ZOOM}
          maxZoom={limits.maxZoom ?? MAPLIBRE_CAMERA_MAX_ZOOM}
          duration={MAPLIBRE_CAMERA_ANIMATION_MS}
          easing="ease"
        />
        <MapLibreRoadsBuildingsLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
        />
        <MapLibrePlacesLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
        />
        <MapLibreEducationLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
        />
        <MapLibreUsersLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
        />
        <MapLibreGamesLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
        />
        <MapLibreCommerceLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
        />
        <MapLibreEventsLayer
          adapter={adapter}
          surfaceRevision={surfaceRevision}
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
