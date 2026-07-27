/**
 * MapLibre World Renderer — display adapter only.
 * Style URLs must be injected by Runtime from WorldMapSource (never hardcoded here).
 * Camera navigation is operational via CameraAdapter (Runtime-owned).
 */

import type { WorldCamera } from "@/src/lib/world/types";
import type { WorldCommerceMarker } from "@/src/lib/world/commerce";
import { COMMERCE_FOCUS_ZOOM } from "@/src/lib/world/commerce";
import type { WorldEventMarker } from "@/src/lib/world/events";
import { EVENT_FOCUS_ZOOM } from "@/src/lib/world/events";
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
  WorldMapProjection,
  WorldRendererAdapter,
} from "@/src/lib/world/renderer/types";
import { toFoundationRendererCapability } from "@/src/lib/world/renderer/types";
import type {
  WorldMapSourceExperience,
  WorldVectorOverlaySpec,
} from "@/src/lib/world/mapSource/experience";
import { createEmptyMapSourceExperience } from "@/src/lib/world/mapSource/experience";
import {
  clampMapLibreZoom,
  createDefaultMapLibreCamera,
  getMapLibreZoomLimits,
  MAPLIBRE_CAMERA_ZOOM_STEP,
  MAPLIBRE_DEFAULT_CAMERA,
  normalizeMapLibreCamera,
  type MapLibreZoomLimits,
} from "@/src/lib/world/renderer/maplibre/cameraNavigation";
import {
  isWorldBuildingsMode,
  isWorldRoadDetail,
  resolveEffectiveBuildingsMode,
  type WorldBuildingsMode,
  type WorldRoadDetail,
} from "@/src/lib/world/renderer/maplibre/roadsBuildings";

export const MAPLIBRE_RENDERER_ID = "world-renderer-maplibre" as const;

export { MAPLIBRE_DEFAULT_CAMERA };

/** Detect terrain-capable inline or remote styles by known topo tile path. */
export function isTerrainCapableStyleUrl(url: string): boolean {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (trimmed.length === 0) return false;
  return (
    trimmed.includes("World_Topo_Map") ||
    trimmed.includes("UM World Terrain")
  );
}

export type PlacePressHandler = (placeId: string) => void;
export type EducationPressHandler = (educationId: string) => void;
export type UserPressHandler = (userId: string) => void;
export type GamePressHandler = (gameId: string) => void;
export type CommercePressHandler = (commerceId: string) => void;
export type EventPressHandler = (eventId: string) => void;

export type MapLibreRendererAdapter = WorldRendererAdapter & {
  /** Bound style URL from Runtime / Map Source — empty when unbound. */
  getStyleUrl(): string;
  /** Swap style URL without resetting session camera — remounts map surface. */
  setStyleUrl(next: string): boolean;
  /** True when terrain elevation/hillshade is soft-enabled on a terrain-capable style. */
  isTerrainEnabled(): boolean;
  /** Soft-enable terrain visualization — fail-closed when unsupported or not on terrain style. */
  setTerrainEnabled(enabled: boolean): boolean;
  /** Inject vector overlay from MapSource via Runtime — never hardcode tile URLs here. */
  setVectorOverlay(spec: WorldVectorOverlaySpec | null): void;
  getVectorOverlay(): WorldVectorOverlaySpec | null;
  setBasemapExperience(experience: WorldMapSourceExperience): void;
  getBasemapExperience(): WorldMapSourceExperience;
  setRoadDetail(detail: WorldRoadDetail): boolean;
  getRoadDetail(): WorldRoadDetail;
  setBuildingsMode(mode: WorldBuildingsMode): boolean;
  getBuildingsMode(): WorldBuildingsMode;
  getEffectiveBuildingsMode(): WorldBuildingsMode;
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
  setCommerceMarkers(markers: WorldCommerceMarker[]): void;
  getCommerceMarkers(): WorldCommerceMarker[];
  getSelectedCommerceMarkerId(): string | null;
  setSelectedCommerceMarkerId(commerceId: string | null): void;
  clearSelectedCommerceMarker(): void;
  setCommercePressHandler(handler: CommercePressHandler | null): void;
  reportCommercePress(commerceId: string): void;
  setEventMarkers(markers: WorldEventMarker[]): void;
  getEventMarkers(): WorldEventMarker[];
  getSelectedEventMarkerId(): string | null;
  setSelectedEventMarkerId(eventId: string | null): void;
  clearSelectedEventMarker(): void;
  setEventPressHandler(handler: EventPressHandler | null): void;
  reportEventPress(eventId: string): void;
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
  let styleUrl =
    typeof options?.styleUrl === "string" ? options.styleUrl.trim() : "";
  let hasStyle = styleUrl.length > 0;
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
  let commerceMarkers: WorldCommerceMarker[] = [];
  let selectedCommerceMarkerId: string | null = null;
  let commercePressHandler: CommercePressHandler | null = null;
  let eventMarkers: WorldEventMarker[] = [];
  let selectedEventMarkerId: string | null = null;
  let eventPressHandler: EventPressHandler | null = null;
  let terrainEnabled = false;
  let terrainStyleActive = isTerrainCapableStyleUrl(styleUrl);
  let projection: WorldMapProjection = "mercator";
  let vectorOverlay: WorldVectorOverlaySpec | null = null;
  let basemapExperience: WorldMapSourceExperience =
    createEmptyMapSourceExperience();
  let roadDetail: WorldRoadDetail = "medium";
  let buildingsMode: WorldBuildingsMode = "2d";

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
    supportsTerrain: true,
    supportsOffline: false,
    supportsStreetLabels: true,
    supportsSatellite: true,
    supportsCustomLayers: true,
    supportsBuildings: true,
    supportsGlobe: false,
    supportsProjectionSwitch: true,
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
    getProjection(): WorldMapProjection {
      return projection;
    },
    setProjection(mode: WorldMapProjection): boolean {
      try {
        if (mode === projection) return true;
        if (mode === "globe" && !caps.supportsGlobe) return false;
        if (mode === "mercator") {
          projection = "mercator";
          bump();
          return true;
        }
        projection = "globe";
        bump();
        return true;
      } catch {
        return false;
      }
    },
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
    setStyleUrl(next: string): boolean {
      const trimmed = typeof next === "string" ? next.trim() : "";
      if (trimmed.length === 0) return false;
      if (trimmed === styleUrl) return true;
      styleUrl = trimmed;
      hasStyle = true;
      styleReady = false;
      loadError = null;
      terrainStyleActive = isTerrainCapableStyleUrl(trimmed);
      if (!terrainStyleActive) {
        terrainEnabled = false;
      }
      // Overlay / experience are re-injected by Runtime after style swap.
      mountGeneration += 1;
      bump();
      return true;
    },
    isTerrainEnabled(): boolean {
      return (
        caps.supportsTerrain &&
        mounted &&
        terrainStyleActive &&
        terrainEnabled
      );
    },
    setTerrainEnabled(enabled: boolean): boolean {
      if (!caps.supportsTerrain) return false;
      if (enabled) {
        if (!mounted || !terrainStyleActive) return false;
        terrainEnabled = true;
        bump();
        return true;
      }
      if (!terrainEnabled) return true;
      terrainEnabled = false;
      bump();
      return true;
    },
    setVectorOverlay(spec: WorldVectorOverlaySpec | null): void {
      if (
        spec == null ||
        !Array.isArray(spec.tiles) ||
        spec.tiles.length === 0
      ) {
        vectorOverlay = null;
        bump();
        return;
      }
      vectorOverlay = {
        tiles: [...spec.tiles],
        attribution:
          typeof spec.attribution === "string" ? spec.attribution : "",
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
      };
      bump();
    },
    getVectorOverlay(): WorldVectorOverlaySpec | null {
      if (!vectorOverlay) return null;
      return {
        tiles: [...vectorOverlay.tiles],
        attribution: vectorOverlay.attribution,
        minzoom: vectorOverlay.minzoom,
        maxzoom: vectorOverlay.maxzoom,
      };
    },
    setBasemapExperience(experience: WorldMapSourceExperience): void {
      basemapExperience = experience ?? createEmptyMapSourceExperience();
      bump();
    },
    getBasemapExperience(): WorldMapSourceExperience {
      return basemapExperience;
    },
    setRoadDetail(detail: WorldRoadDetail): boolean {
      try {
        if (!isWorldRoadDetail(detail)) return false;
        if (roadDetail === detail) return true;
        roadDetail = detail;
        bump();
        return true;
      } catch {
        return false;
      }
    },
    getRoadDetail(): WorldRoadDetail {
      return roadDetail;
    },
    setBuildingsMode(mode: WorldBuildingsMode): boolean {
      try {
        if (!isWorldBuildingsMode(mode)) return false;
        if (buildingsMode === mode) return true;
        buildingsMode = mode;
        bump();
        return true;
      } catch {
        return false;
      }
    },
    getBuildingsMode(): WorldBuildingsMode {
      return buildingsMode;
    },
    getEffectiveBuildingsMode(): WorldBuildingsMode {
      return resolveEffectiveBuildingsMode({
        preference: buildingsMode,
        rendererSupportsBuildings: caps.supportsBuildings,
        rendererSupports3D: caps.supports3D,
        sourceSupports2d: basemapExperience.supportsBuildings2d,
        sourceSupports3d: basemapExperience.supportsBuildings3d,
      });
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
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedGameMarkerId = null;
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedGameMarkerId = null;
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
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
    setCommerceMarkers(markers: WorldCommerceMarker[]): void {
      commerceMarkers = Array.isArray(markers)
        ? markers.map((m) => ({ ...m }))
        : [];
      if (
        selectedCommerceMarkerId &&
        !commerceMarkers.some((m) => m.id === selectedCommerceMarkerId)
      ) {
        selectedCommerceMarkerId = null;
        selectedEventMarkerId = null;
      }
      bump();
    },
    getCommerceMarkers(): WorldCommerceMarker[] {
      return commerceMarkers.map((m) => ({ ...m }));
    },
    getSelectedCommerceMarkerId(): string | null {
      return selectedCommerceMarkerId;
    },
    setSelectedCommerceMarkerId(commerceId: string | null): void {
      if (commerceId == null) {
        if (selectedCommerceMarkerId == null) return;
        selectedCommerceMarkerId = null;
        selectedEventMarkerId = null;
        bump();
        return;
      }
      if (!commerceMarkers.some((m) => m.id === commerceId)) return;
      if (selectedCommerceMarkerId === commerceId) return;
      selectedCommerceMarkerId = commerceId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      selectedEventMarkerId = null;
      bump();
    },
    clearSelectedCommerceMarker(): void {
      if (selectedCommerceMarkerId == null) return;
      selectedCommerceMarkerId = null;
      selectedEventMarkerId = null;
      bump();
    },
    setCommercePressHandler(handler: CommercePressHandler | null): void {
      commercePressHandler = handler;
    },
    reportCommercePress(commerceId: string): void {
      if (!commerceId || typeof commerceId !== "string") return;
      const marker = commerceMarkers.find((m) => m.id === commerceId);
      if (!marker) return;
      selectedCommerceMarkerId = commerceId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      selectedEventMarkerId = null;
      if (canNavigate()) {
        sessionCamera = normalizeMapLibreCamera(
          {
            latitude: marker.latitude,
            longitude: marker.longitude,
            zoom: Math.max(sessionCamera.zoom, COMMERCE_FOCUS_ZOOM),
            bearing: sessionCamera.bearing,
            pitch: sessionCamera.pitch,
          },
          sessionCamera
        );
      }
      bump();
      try {
        commercePressHandler?.(commerceId);
      } catch {
        // Fail-closed.
      }
    },
    setEventMarkers(markers: WorldEventMarker[]): void {
      eventMarkers = Array.isArray(markers)
        ? markers.map((m) => ({ ...m }))
        : [];
      if (
        selectedEventMarkerId &&
        !eventMarkers.some((m) => m.id === selectedEventMarkerId)
      ) {
        selectedEventMarkerId = null;
      }
      bump();
    },
    getEventMarkers(): WorldEventMarker[] {
      return eventMarkers.map((m) => ({ ...m }));
    },
    getSelectedEventMarkerId(): string | null {
      return selectedEventMarkerId;
    },
    setSelectedEventMarkerId(eventId: string | null): void {
      if (eventId == null) {
        if (selectedEventMarkerId == null) return;
        selectedEventMarkerId = null;
        bump();
        return;
      }
      if (!eventMarkers.some((m) => m.id === eventId)) return;
      if (selectedEventMarkerId === eventId) return;
      selectedEventMarkerId = eventId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      selectedCommerceMarkerId = null;
      bump();
    },
    clearSelectedEventMarker(): void {
      if (selectedEventMarkerId == null) return;
      selectedEventMarkerId = null;
      bump();
    },
    setEventPressHandler(handler: EventPressHandler | null): void {
      eventPressHandler = handler;
    },
    reportEventPress(eventId: string): void {
      if (!eventId || typeof eventId !== "string") return;
      const marker = eventMarkers.find((m) => m.id === eventId);
      if (!marker) return;
      selectedEventMarkerId = eventId;
      selectedPlaceMarkerId = null;
      selectedEducationMarkerId = null;
      selectedUserMarkerId = null;
      selectedGameMarkerId = null;
      selectedCommerceMarkerId = null;
      if (canNavigate()) {
        sessionCamera = normalizeMapLibreCamera(
          {
            latitude: marker.latitude,
            longitude: marker.longitude,
            zoom: Math.max(sessionCamera.zoom, EVENT_FOCUS_ZOOM),
            bearing: sessionCamera.bearing,
            pitch: sessionCamera.pitch,
          },
          sessionCamera
        );
      }
      bump();
      try {
        eventPressHandler?.(eventId);
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
