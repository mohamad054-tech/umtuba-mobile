import type { WorldCamera, WorldViewport } from "@/src/lib/world/types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidLatitude(value: number): boolean {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

/**
 * Parse a camera. Invalid coordinates/zoom fail closed (null).
 * Does not invent a default city or region.
 */
export function parseWorldCamera(raw: unknown): WorldCamera | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const latitude = r.latitude;
  const longitude = r.longitude;
  const zoom = r.zoom;
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    !isFiniteNumber(zoom)
  ) {
    return null;
  }
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  if (zoom < 0 || zoom > 22) return null;

  const bearing = isFiniteNumber(r.bearing) ? r.bearing : 0;
  const pitch = isFiniteNumber(r.pitch) ? r.pitch : 0;

  return {
    latitude,
    longitude,
    zoom,
    bearing,
    pitch: Math.max(0, Math.min(85, pitch)),
  };
}

export function parseWorldViewport(raw: unknown): WorldViewport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const { north, south, east, west } = r;
  if (
    !isFiniteNumber(north) ||
    !isFiniteNumber(south) ||
    !isFiniteNumber(east) ||
    !isFiniteNumber(west)
  ) {
    return null;
  }
  if (
    !isValidLatitude(north) ||
    !isValidLatitude(south) ||
    !isValidLongitude(east) ||
    !isValidLongitude(west)
  ) {
    return null;
  }
  if (north < south) return null;
  return { north, south, east, west };
}
