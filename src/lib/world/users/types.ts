/**
 * World Users Layer — privacy-safe public presence (no MapLibre / PII).
 */

import type {
  WorldUserPresence,
  WorldUserRecord,
} from "@/src/lib/world/dataPipeline/types";

export type { WorldUserPresence, WorldUserRecord };

export const WORLD_USERS_LAYER_ID = "users" as const;
export const WORLD_USERS_LAYER_REF = "world-users-layer" as const;

/** Clusters active below this zoom; points separate when closer. */
export const USER_CLUSTER_MAX_ZOOM = 5.5;

/** Camera zoom when focusing a selected user (approximate pin). */
export const USER_FOCUS_ZOOM = 6.2;

export function formatWorldUserPresenceLabel(
  presence: WorldUserPresence
): string | null {
  if (presence === "online") return "Online";
  if (presence === "active_recently") return "Active recently";
  return null;
}

export function userDisplayInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Normalize + privacy gate.
 * Rejects invalid rows and users who opted out of map visibility.
 * Strips any accidental PII-shaped fields by only returning the public contract.
 */
export function normalizeWorldUserRecord(
  raw: WorldUserRecord
): WorldUserRecord | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (raw.mapVisible !== true) return null;

  const displayName =
    typeof raw.displayName === "string" && raw.displayName.trim().length > 0
      ? raw.displayName.trim()
      : null;
  const handleRaw =
    typeof raw.handle === "string" && raw.handle.trim().length > 0
      ? raw.handle.trim().replace(/^@+/, "")
      : null;
  const cityName =
    typeof raw.cityName === "string" && raw.cityName.trim().length > 0
      ? raw.cityName.trim()
      : null;
  if (!displayName || !handleRaw || !cityName) return null;

  // Reject handle that looks like email/phone (fail-closed privacy).
  if (handleRaw.includes("@") || /\d{6,}/.test(handleRaw)) return null;
  if (displayName.includes("@")) return null;

  const approximateLatitude =
    typeof raw.approximateLatitude === "number" &&
    Number.isFinite(raw.approximateLatitude)
      ? roundApproxCoord(raw.approximateLatitude)
      : null;
  const approximateLongitude =
    typeof raw.approximateLongitude === "number" &&
    Number.isFinite(raw.approximateLongitude)
      ? roundApproxCoord(raw.approximateLongitude)
      : null;

  const presence: WorldUserPresence =
    raw.presence === "online" || raw.presence === "active_recently"
      ? raw.presence
      : null;

  return {
    id: raw.id.trim(),
    displayName,
    handle: handleRaw,
    cityName,
    approximateLatitude,
    approximateLongitude,
    mapVisible: true,
    presence,
  };
}

/** Coarsen coordinates to ~city-block privacy fuzz (~0.01°). */
function roundApproxCoord(value: number): number {
  return Math.round(value * 100) / 100;
}
