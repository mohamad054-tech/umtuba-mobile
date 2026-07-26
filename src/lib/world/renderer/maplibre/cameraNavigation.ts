/**
 * MapLibre camera navigation — zoom limits, clamp, session helpers.
 * Runtime still owns control via CameraAdapter; this module is renderer-internal.
 */

import {
  isValidLatitude,
  isValidLongitude,
} from "@/src/lib/world/camera";
import type { WorldCamera } from "@/src/lib/world/types";

/** Default session camera when World first opens. */
export const MAPLIBRE_DEFAULT_CAMERA: WorldCamera = {
  latitude: 20,
  longitude: 0,
  zoom: 1.8,
  bearing: 0,
  pitch: 0,
};

/** Operational zoom floor for World MapLibre navigation. */
export const MAPLIBRE_CAMERA_MIN_ZOOM = 1;

/** Operational zoom ceiling for World MapLibre navigation. */
export const MAPLIBRE_CAMERA_MAX_ZOOM = 18;

/** Programmatic zoom-in / zoom-out step. */
export const MAPLIBRE_CAMERA_ZOOM_STEP = 1;

/** Ease duration for toolbar / recenter camera moves (ms). */
export const MAPLIBRE_CAMERA_ANIMATION_MS = 320;

export type MapLibreZoomLimits = {
  minZoom: number;
  maxZoom: number;
};

export function getMapLibreZoomLimits(): MapLibreZoomLimits {
  return {
    minZoom: MAPLIBRE_CAMERA_MIN_ZOOM,
    maxZoom: MAPLIBRE_CAMERA_MAX_ZOOM,
  };
}

export function clampMapLibreZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MAPLIBRE_DEFAULT_CAMERA.zoom;
  return Math.min(
    MAPLIBRE_CAMERA_MAX_ZOOM,
    Math.max(MAPLIBRE_CAMERA_MIN_ZOOM, zoom)
  );
}

export function clampMapLibreLatitude(latitude: number): number {
  if (!Number.isFinite(latitude)) return MAPLIBRE_DEFAULT_CAMERA.latitude;
  return Math.min(85, Math.max(-85, latitude));
}

export function clampMapLibreLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) return MAPLIBRE_DEFAULT_CAMERA.longitude;
  let lng = longitude;
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

/**
 * Normalize a camera snapshot for session storage / programmatic apply.
 * Invalid fields fall back to previous or defaults — never NaN.
 */
export function normalizeMapLibreCamera(
  partial: Partial<WorldCamera>,
  previous?: WorldCamera | null
): WorldCamera {
  const base = previous ?? MAPLIBRE_DEFAULT_CAMERA;
  const latitude =
    typeof partial.latitude === "number" && isValidLatitude(partial.latitude)
      ? clampMapLibreLatitude(partial.latitude)
      : clampMapLibreLatitude(base.latitude);
  const longitude =
    typeof partial.longitude === "number" &&
    isValidLongitude(partial.longitude)
      ? clampMapLibreLongitude(partial.longitude)
      : clampMapLibreLongitude(base.longitude);
  const zoom =
    typeof partial.zoom === "number"
      ? clampMapLibreZoom(partial.zoom)
      : clampMapLibreZoom(base.zoom);
  const bearing =
    typeof partial.bearing === "number" && Number.isFinite(partial.bearing)
      ? partial.bearing
      : base.bearing;
  const pitch =
    typeof partial.pitch === "number" && Number.isFinite(partial.pitch)
      ? Math.max(0, Math.min(60, partial.pitch))
      : base.pitch;

  return { latitude, longitude, zoom, bearing, pitch };
}

export function createDefaultMapLibreCamera(): WorldCamera {
  return { ...MAPLIBRE_DEFAULT_CAMERA };
}
