/**
 * MapLibre World Renderer — adapter logic only (no UI imports of MapLibre).
 * Dev tiles: MapLibre demotiles (not a paid/production provider).
 */

import type { WorldCamera } from "@/src/lib/world/types";
import type {
  CameraAdapter,
  LayerAdapter,
  ProjectionAdapter,
  RendererCapabilities,
  WorldRendererAdapter,
} from "@/src/lib/world/renderer/types";
import { toFoundationRendererCapability } from "@/src/lib/world/renderer/types";

export const MAPLIBRE_RENDERER_ID = "world-renderer-maplibre" as const;

/** Development-only style — MapLibre demo tiles (no API key / paid vendor). */
export const MAPLIBRE_DEV_STYLE_URL =
  "https://demotiles.maplibre.org/style.json";

/** Development-only attribution — not a production tile vendor claim. */
export const MAPLIBRE_DEV_ATTRIBUTION =
  "MapLibre demotiles (development only). Not a production map source.";

export const MAPLIBRE_DEFAULT_CAMERA: WorldCamera = {
  latitude: 20,
  longitude: 0,
  zoom: 1.8,
  bearing: 0,
  pitch: 0,
};

export type MapLibreRendererAdapter = WorldRendererAdapter & {
  getStyleUrl(): string;
  getCameraRevision(): number;
  /** Bumps on each mount so Retry can remount the native Map surface. */
  getMountGeneration(): number;
  subscribe(listener: () => void): () => void;
  syncCameraFromMap(camera: Partial<WorldCamera>): void;
  reportStyleLoaded(): void;
  reportStyleFailed(message?: string): void;
  getLoadError(): string | null;
  isStyleReady(): boolean;
};

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MAPLIBRE_DEFAULT_CAMERA.zoom;
  return Math.min(22, Math.max(0, zoom));
}

export function createMapLibreRendererAdapter(options?: {
  styleUrl?: string;
  initialCamera?: WorldCamera;
}): MapLibreRendererAdapter {
  const styleUrl = options?.styleUrl?.trim() || MAPLIBRE_DEV_STYLE_URL;
  let camera: WorldCamera = {
    ...(options?.initialCamera ?? MAPLIBRE_DEFAULT_CAMERA),
  };
  let mounted = false;
  let styleReady = false;
  let loadError: string | null = null;
  let revision = 0;
  let mountGeneration = 0;
  const listeners = new Set<() => void>();
  const layerVisibility = new Map<string, boolean>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const bump = () => {
    revision += 1;
    emit();
  };

  const caps: RendererCapabilities = {
    supports3D: true,
    supportsTerrain: false,
    supportsOffline: false,
    supportsStreetLabels: true,
    supportsSatellite: false,
    supportsCustomLayers: true,
    supportsBuildings: false,
  };

  const cameraAdapter: CameraAdapter = {
    id: "world-camera-maplibre",
    getCamera(): WorldCamera | null {
      return { ...camera };
    },
    setCamera(next: WorldCamera): boolean {
      if (!mounted || loadError) return false;
      camera = {
        latitude: next.latitude,
        longitude: next.longitude,
        zoom: clampZoom(next.zoom),
        bearing: next.bearing,
        pitch: next.pitch,
      };
      bump();
      return true;
    },
    zoomIn(): boolean {
      if (!mounted || loadError) return false;
      camera = { ...camera, zoom: clampZoom(camera.zoom + 1) };
      bump();
      return true;
    },
    zoomOut(): boolean {
      if (!mounted || loadError) return false;
      camera = { ...camera, zoom: clampZoom(camera.zoom - 1) };
      bump();
      return true;
    },
    recenter(): boolean {
      if (!mounted || loadError) return false;
      camera = { ...MAPLIBRE_DEFAULT_CAMERA };
      bump();
      return true;
    },
    resetOrientation(): boolean {
      if (!mounted || loadError) return false;
      camera = { ...camera, bearing: 0, pitch: 0 };
      bump();
      return true;
    },
  };

  const layerAdapter: LayerAdapter = {
    id: "world-layer-maplibre",
    listLayerIds(): string[] {
      return [
        "users",
        "cities",
        "education",
        "games",
        "events",
        "businesses",
        "ai",
        "future",
      ];
    },
    setLayerVisibility(layerId: string, visible: boolean): boolean {
      if (!mounted) return false;
      layerVisibility.set(layerId, visible);
      bump();
      return true;
    },
    isLayerVisible(layerId: string): boolean {
      return layerVisibility.get(layerId) === true;
    },
  };

  const projectionAdapter: ProjectionAdapter = {
    id: "world-projection-maplibre",
    // Sync projection requires a live MapRef; fail-closed until engine wiring.
    project(): { x: number; y: number } | null {
      return null;
    },
    unproject(): { latitude: number; longitude: number } | null {
      return null;
    },
  };

  const adapter: MapLibreRendererAdapter = {
    id: MAPLIBRE_RENDERER_ID,
    family: "vector_2d",
    isBound(): boolean {
      return mounted && loadError == null;
    },
    getCapabilities(): RendererCapabilities {
      return { ...caps };
    },
    getCameraAdapter(): CameraAdapter {
      return cameraAdapter;
    },
    getLayerAdapter(): LayerAdapter {
      return layerAdapter;
    },
    getProjectionAdapter(): ProjectionAdapter {
      return projectionAdapter;
    },
    mount(): void {
      mounted = true;
      loadError = null;
      styleReady = false;
      mountGeneration += 1;
      bump();
    },
    unmount(): void {
      mounted = false;
      styleReady = false;
      bump();
    },
    capability: toFoundationRendererCapability("vector_2d", caps),
    getStyleUrl(): string {
      return styleUrl;
    },
    getCameraRevision(): number {
      return revision;
    },
    getMountGeneration(): number {
      return mountGeneration;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    syncCameraFromMap(partial: Partial<WorldCamera>): void {
      camera = {
        latitude:
          typeof partial.latitude === "number"
            ? partial.latitude
            : camera.latitude,
        longitude:
          typeof partial.longitude === "number"
            ? partial.longitude
            : camera.longitude,
        zoom:
          typeof partial.zoom === "number"
            ? clampZoom(partial.zoom)
            : camera.zoom,
        bearing:
          typeof partial.bearing === "number"
            ? partial.bearing
            : camera.bearing,
        pitch:
          typeof partial.pitch === "number" ? partial.pitch : camera.pitch,
      };
      // Do not bump revision on map-driven sync to avoid camera feedback loops.
      emit();
    },
    reportStyleLoaded(): void {
      styleReady = true;
      loadError = null;
      bump();
    },
    reportStyleFailed(message?: string): void {
      styleReady = false;
      loadError =
        typeof message === "string" && message.trim().length > 0
          ? message.trim()
          : "Unable to load World map style.";
      bump();
    },
    getLoadError(): string | null {
      return loadError;
    },
    isStyleReady(): boolean {
      return styleReady && loadError == null;
    },
  };

  return adapter;
}

export function isMapLibreRendererAdapter(
  adapter: WorldRendererAdapter
): adapter is MapLibreRendererAdapter {
  return adapter.id === MAPLIBRE_RENDERER_ID;
}
