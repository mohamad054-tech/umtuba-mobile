/**
 * MapLibre World Renderer — display adapter only.
 * Style URLs must be injected by Runtime from WorldMapSource (never hardcoded here).
 * Camera navigation is operational via CameraAdapter (Runtime-owned).
 */

import type { WorldCamera } from "@/src/lib/world/types";
import type { WorldEducationMarker } from "@/src/lib/world/education";
import type { WorldGameMarker } from "@/src/lib/world/games";
import { GAME_FOCUS_ZOOM } from "@/src/lib/world/games";
import type { WorldPlaceMarker } from "@/src/lib/world/places";
import { PLACE_FOCUS_ZOOM } from "@/src/lib/world/places/placeUx";
import type { WorldUserMarker } from "@/src/lib/world/users";
import { USER_FOCUS_ZOOM } from "@/src/lib/world/users";
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

export type PlacePressHandler = (placeId: string) => void;
export type EducationPressHandler = (educationId: string) => void;
export type UserPressHandler = (userId: string) => void;
export type GamePressHandler = (gameId: string) => void;

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
  /** Places markers from Runtime — empty when provider unbound. */
  setPlaceMarkers(markers: WorldPlaceMarker[]): void;
  getPlaceMarkers(): WorldPlaceMarker[];
  getSelectedPlaceMarkerId(): string | null;
  setSelectedPlaceMarkerId(placeId: string | null): void;
  clearSelectedPlaceMarker(): void;
  setPlacePressHandler(handler: PlacePressHandler | null): void;
  reportPlacePress(placeId: string): void;
  /** Education markers — separate from places. */
  setEducationMarkers(markers: WorldEducationMarker[]): void;
  getEducationMarkers(): WorldEducationMarker[];
  getSelectedEducationMarkerId(): string | null;
  setSelectedEducationMarkerId(educationId: string | null): void;
  clearSelectedEducationMarker(): void;
  setEducationPressHandler(handler: EducationPressHandler | null): void;
  reportEducationPress(educationId: string): void;
  /** Users markers — approximate public pins only. */
  setUserMarkers(markers: WorldUserMarker[]): void;
  getUserMarkers(): WorldUserMarker[];
  getSelectedUserMarkerId(): string | null;
  setSelectedUserMarkerId(userId: string | null): void;
  clearSelectedUserMarker(): void;
  setUserPressHandler(handler: UserPressHandler | null): void;
  reportUserPress(userId: string): void;
  setGameMarkers(markers: WorldGameMarker[]): void;
  getGameMarkers(): WorldGameMarker[];
  getSelectedGameMarkerId(): string | null;
  setSelectedGameMarkerId(gameId: string | null): void;
  clearSelectedGameMarker(): void;
  setGamePressHandler(handler: GamePressHandler | null): void;
  reportGamePress(gameId: string): void;
  /** Programmatic camera focus (selection / cluster expand). */
  focusPlaceAt(latitude: number, longitude: number, zoom?: number): boolean;
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
  let placeMarkers: WorldPlaceMarker[] = [];
  let selectedPlaceMarkerId: string | null = null;
  let placePressHandler: PlacePressHandler | null = null;
  let educationMarkers: WorldEducationMarker[] = [];
  let selectedEducationMarkerId: string | null = null;
  let educationPressHandler: EducationPressHandler | null = null;
  let userMarkers: WorldUserMarker[] = [];
  let selectedUserMarkerId: string | null = null;
  let userPressHandler: UserPressHandler | null = null;
  let gameMarkers: WorldGameMarker[] = [];
  let selectedGameMarkerId: string | null = null;
  let gamePressHandler: GamePressHandler | null = null;

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
    setPlaceMarkers(markers: WorldPlaceMarker[]): void {
      placeMarkers = Array.isArray(markers)
        ? markers.map((m) => ({ ...m }))
        : [];
      if (
        selectedPlaceMarkerId &&
        !placeMarkers.some((m) => m.id === selectedPlaceMarkerId)
      ) {
        selectedPlaceMarkerId = null;
      }
      bump();
    },
    getPlaceMarkers(): WorldPlaceMarker[] {
      return placeMarkers.map((m) => ({ ...m }));
    },
    getSelectedPlaceMarkerId(): string | null {
      return selectedPlaceMarkerId;
    },
    setSelectedPlaceMarkerId(placeId: string | null): void {
      if (placeId == null) {
        if (selectedPlaceMarkerId == null) return;
        selectedPlaceMarkerId = null;
        bump();
        return;
      }
      if (!placeMarkers.some((m) => m.id === placeId)) return;
      if (selectedPlaceMarkerId === placeId) return;
      selectedPlaceMarkerId = placeId;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      bump();
    },
    clearSelectedPlaceMarker(): void {
      if (selectedPlaceMarkerId == null) return;
      selectedPlaceMarkerId = null;
      bump();
    },
    setPlacePressHandler(handler: PlacePressHandler | null): void {
      placePressHandler = handler;
    },
    reportPlacePress(placeId: string): void {
      if (!placeId || typeof placeId !== "string") return;
      const marker = placeMarkers.find((m) => m.id === placeId);
      if (!marker) return;
      selectedPlaceMarkerId = placeId;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      // Focus camera on selection for professional UX.
      if (canNavigate()) {
        sessionCamera = normalizeMapLibreCamera(
          {
            latitude: marker.latitude,
            longitude: marker.longitude,
            zoom: Math.max(sessionCamera.zoom, PLACE_FOCUS_ZOOM),
            bearing: sessionCamera.bearing,
            pitch: sessionCamera.pitch,
          },
          sessionCamera
        );
      }
      bump();
      try {
        placePressHandler?.(placeId);
      } catch {
        // Fail-closed: place press must not crash the map surface.
      }
    },
    setEducationMarkers(markers: WorldEducationMarker[]): void {
      educationMarkers = Array.isArray(markers)
        ? markers.map((m) => ({ ...m }))
        : [];
      if (
        selectedEducationMarkerId &&
        !educationMarkers.some((m) => m.id === selectedEducationMarkerId)
      ) {
        selectedEducationMarkerId = null;
      }
      bump();
    },
    getEducationMarkers(): WorldEducationMarker[] {
      return educationMarkers.map((m) => ({ ...m }));
    },
    getSelectedEducationMarkerId(): string | null {
      return selectedEducationMarkerId;
    },
    setSelectedEducationMarkerId(educationId: string | null): void {
      if (educationId == null) {
        if (selectedEducationMarkerId == null) return;
        selectedEducationMarkerId = null;
        bump();
        return;
      }
      if (!educationMarkers.some((m) => m.id === educationId)) return;
      if (selectedEducationMarkerId === educationId) return;
      selectedEducationMarkerId = educationId;
      selectedPlaceMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      bump();
    },
    clearSelectedEducationMarker(): void {
      if (selectedEducationMarkerId == null) return;
      selectedEducationMarkerId = null;
      bump();
    },
    setEducationPressHandler(handler: EducationPressHandler | null): void {
      educationPressHandler = handler;
    },
    reportEducationPress(educationId: string): void {
      if (!educationId || typeof educationId !== "string") return;
      const marker = educationMarkers.find((m) => m.id === educationId);
      if (!marker) return;
      selectedEducationMarkerId = educationId;
      selectedPlaceMarkerId = null;
      selectedUserMarkerId = null;
      if (canNavigate()) {
        sessionCamera = normalizeMapLibreCamera(
          {
            latitude: marker.latitude,
            longitude: marker.longitude,
            zoom: Math.max(sessionCamera.zoom, PLACE_FOCUS_ZOOM),
            bearing: sessionCamera.bearing,
            pitch: sessionCamera.pitch,
          },
          sessionCamera
        );
      }
      bump();
      try {
        educationPressHandler?.(educationId);
      } catch {
        // Fail-closed.
      }
    },
    setUserMarkers(markers: WorldUserMarker[]): void {
      userMarkers = Array.isArray(markers)
        ? markers.map((m) => ({ ...m }))
        : [];
      if (
        selectedUserMarkerId &&
        !userMarkers.some((m) => m.id === selectedUserMarkerId)
      ) {
        selectedUserMarkerId = null;
      }
      bump();
    },
    getUserMarkers(): WorldUserMarker[] {
      return userMarkers.map((m) => ({ ...m }));
    },
    getSelectedUserMarkerId(): string | null {
      return selectedUserMarkerId;
    },
    setSelectedUserMarkerId(userId: string | null): void {
      if (userId == null) {
        if (selectedUserMarkerId == null) return;
        selectedUserMarkerId = null;
        bump();
        return;
      }
      if (!userMarkers.some((m) => m.id === userId)) return;
      if (selectedUserMarkerId === userId) return;
      selectedUserMarkerId = userId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedGameMarkerId = null;
      bump();
    },
    clearSelectedUserMarker(): void {
      if (selectedUserMarkerId == null) return;
      selectedUserMarkerId = null;
      bump();
    },
    setUserPressHandler(handler: UserPressHandler | null): void {
      userPressHandler = handler;
    },
    reportUserPress(userId: string): void {
      if (!userId || typeof userId !== "string") return;
      const marker = userMarkers.find((m) => m.id === userId);
      if (!marker) return;
      selectedUserMarkerId = userId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      if (canNavigate()) {
        sessionCamera = normalizeMapLibreCamera(
          {
            latitude: marker.latitude,
            longitude: marker.longitude,
            zoom: Math.max(sessionCamera.zoom, USER_FOCUS_ZOOM),
            bearing: sessionCamera.bearing,
            pitch: sessionCamera.pitch,
          },
          sessionCamera
        );
      }
      bump();
      try {
        userPressHandler?.(userId);
      } catch {
        // Fail-closed.
      }
    },
    setGameMarkers(markers: WorldGameMarker[]): void {
      gameMarkers = Array.isArray(markers) ? markers.map((m) => ({ ...m })) : [];
      if (
        selectedGameMarkerId &&
        !gameMarkers.some((m) => m.id === selectedGameMarkerId)
      ) {
        selectedGameMarkerId = null;
      }
      bump();
    },
    getGameMarkers(): WorldGameMarker[] {
      return gameMarkers.map((m) => ({ ...m }));
    },
    getSelectedGameMarkerId(): string | null {
      return selectedGameMarkerId;
    },
    setSelectedGameMarkerId(gameId: string | null): void {
      if (gameId == null) {
        if (selectedGameMarkerId == null) return;
        selectedGameMarkerId = null;
        bump();
        return;
      }
      if (!gameMarkers.some((m) => m.id === gameId)) return;
      if (selectedGameMarkerId === gameId) return;
      selectedGameMarkerId = gameId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      bump();
    },
    clearSelectedGameMarker(): void {
      if (selectedGameMarkerId == null) return;
      selectedGameMarkerId = null;
      bump();
    },
    setGamePressHandler(handler: GamePressHandler | null): void {
      gamePressHandler = handler;
    },
    reportGamePress(gameId: string): void {
      if (!gameId || typeof gameId !== "string") return;
      const marker = gameMarkers.find((m) => m.id === gameId);
      if (!marker) return;
      selectedGameMarkerId = gameId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      if (canNavigate()) {
        sessionCamera = normalizeMapLibreCamera(
          {
            latitude: marker.latitude,
            longitude: marker.longitude,
            zoom: Math.max(sessionCamera.zoom, GAME_FOCUS_ZOOM),
            bearing: sessionCamera.bearing,
            pitch: sessionCamera.pitch,
          },
          sessionCamera
        );
      }
      bump();
      try {
        gamePressHandler?.(gameId);
      } catch {
        // Fail-closed.
      }
    },
    focusPlaceAt(latitude: number, longitude: number, zoom?: number): boolean {
      if (!canNavigate()) return false;
      sessionCamera = normalizeMapLibreCamera(
        {
          latitude,
          longitude,
          zoom:
            typeof zoom === "number"
              ? zoom
              : Math.max(sessionCamera.zoom, PLACE_FOCUS_ZOOM),
          bearing: sessionCamera.bearing,
          pitch: sessionCamera.pitch,
        },
        sessionCamera
      );
      bump();
      return true;
    },
  };

  return adapter;
}

export function isMapLibreRendererAdapter(
  adapter: WorldRendererAdapter
): adapter is MapLibreRendererAdapter {
  return adapter.id === MAPLIBRE_RENDERER_ID;
}
