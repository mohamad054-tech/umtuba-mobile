/**
 * MapLibre World Renderer — display adapter only.
 * Style URLs must be injected by Runtime from WorldMapSource (never hardcoded here).
 * Camera navigation is operational via CameraAdapter (Runtime-owned).
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
import {
  clampMapLibreZoom,
  createDefaultMapLibreCamera,
  getMapLibreZoomLimits,
  MAPLIBRE_CAMERA_ZOOM_STEP,
  MAPLIBRE_DEFAULT_CAMERA,
  normalizeMapLibreCamera,
  type MapLibreZoomLimits,
} from "@/src/lib/world/renderer/maplibre/cameraNavigation";

export const MAPLIBRE_RENDERER_ID = "world-renderer-maplibre" as const;

export { MAPLIBRE_DEFAULT_CAMERA };

export type MapLibreRendererAdapter = WorldRendererAdapter & {
  /** Bound style URL from Runtime / Map Source — empty when unbound. */
  getStyleUrl(): string;
  getCameraRevision(): number;
  /** Bumps on each mount so Retry can remount the native Map surface. */
  getMountGeneration(): number;
  /** Session camera (last center/zoom) — survives remount within the adapter. */
  getSessionCamera(): WorldCamera;
  getZoomLimits(): MapLibreZoomLimits;
  subscribe(listener: () => void): () => void;
  syncCameraFromMap(camera: Partial<WorldCamera>): void;
  reportStyleLoaded(): void;
  reportStyleFailed(message?: string): void;
  getLoadError(): string | null;
  isStyleReady(): boolean;
};

/**
 * @param options.styleUrl — Required style from WorldMapSource via Runtime.
 *   Empty / missing URL → fail-closed unbound adapter (no hardcoded demotiles).
 */
export function createMapLibreRendererAdapter(options?: {
  styleUrl?: string | null;
  initialCamera?: WorldCamera;
}): MapLibreRendererAdapter {
  const styleUrl =
    typeof options?.styleUrl === "string" ? options.styleUrl.trim() : "";
  const hasStyle = styleUrl.length > 0;
  /** Session camera — last center/zoom for this World session. */
  let sessionCamera: WorldCamera = normalizeMapLibreCamera(
    options?.initialCamera ?? createDefaultMapLibreCamera()
  );
  let mounted = false;
  let styleReady = false;
  let loadError: string | null = hasStyle
    ? null
    : "World map style is not configured.";
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

  const canNavigate = (): boolean =>
    mounted && loadError == null && hasStyle;

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
      if (!canNavigate()) return null;
      return { ...sessionCamera };
    },
    setCamera(next: WorldCamera): boolean {
      if (!canNavigate()) return false;
      sessionCamera = normalizeMapLibreCamera(next, sessionCamera);
      bump();
      return true;
    },
    zoomIn(): boolean {
      if (!canNavigate()) return false;
      const nextZoom = clampMapLibreZoom(
        sessionCamera.zoom + MAPLIBRE_CAMERA_ZOOM_STEP
      );
      if (nextZoom === sessionCamera.zoom) return false;
      sessionCamera = normalizeMapLibreCamera(
        { ...sessionCamera, zoom: nextZoom },
        sessionCamera
      );
      bump();
      return true;
    },
    zoomOut(): boolean {
      if (!canNavigate()) return false;
      const nextZoom = clampMapLibreZoom(
        sessionCamera.zoom - MAPLIBRE_CAMERA_ZOOM_STEP
      );
      if (nextZoom === sessionCamera.zoom) return false;
      sessionCamera = normalizeMapLibreCamera(
        { ...sessionCamera, zoom: nextZoom },
        sessionCamera
      );
      bump();
      return true;
    },
    recenter(): boolean {
      if (!canNavigate()) return false;
      sessionCamera = createDefaultMapLibreCamera();
      bump();
      return true;
    },
    resetOrientation(): boolean {
      if (!canNavigate()) return false;
      sessionCamera = normalizeMapLibreCamera(
        { ...sessionCamera, bearing: 0, pitch: 0 },
        sessionCamera
      );
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
      if (!mounted || !hasStyle) return false;
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
      return mounted && loadError == null && hasStyle;
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
      if (hasStyle) {
        loadError = null;
        styleReady = false;
      } else {
        loadError = "World map style is not configured.";
        styleReady = false;
      }
      // Preserve sessionCamera across remount (Retry) — do not reset center/zoom.
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
    getSessionCamera(): WorldCamera {
      return { ...sessionCamera };
    },
    getZoomLimits(): MapLibreZoomLimits {
      return getMapLibreZoomLimits();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    syncCameraFromMap(partial: Partial<WorldCamera>): void {
      // Gesture-driven: persist last center/zoom for the session without bumping revision.
      sessionCamera = normalizeMapLibreCamera(partial, sessionCamera);
      emit();
    },
    reportStyleLoaded(): void {
      if (!hasStyle) return;
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
      return styleReady && loadError == null && hasStyle;
    },
  };

  return adapter;
}

export function isMapLibreRendererAdapter(
  adapter: WorldRendererAdapter
): adapter is MapLibreRendererAdapter {
  return adapter.id === MAPLIBRE_RENDERER_ID;
}
