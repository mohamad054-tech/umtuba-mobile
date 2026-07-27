/**
 * World Map Source Foundation — tile/style providers independent of renderers.
 * Renderers must not hardcode tile URLs; Runtime resolves sources via Registry.
 */

import type { WorldMapSourceExperience } from "@/src/lib/world/mapSource/experience";
import { createEmptyMapSourceExperience } from "@/src/lib/world/mapSource/experience";

export type WorldMapSourceKind =
  | "demo"
  | "street"
  | "satellite"
  | "terrain";

/**
 * Provider-agnostic map style contract.
 * Implementations must not import MapLibre / Mapbox / Google Maps engines.
 */
export type WorldMapSource = {
  readonly id: string;
  readonly kind: WorldMapSourceKind;
  readonly label: string;
  /** True only when a concrete style URL is configured and allowed. */
  isAvailable(): boolean;
  /**
   * Map style URL for the active renderer.
   * Returns null when unavailable (fail-closed).
   */
  getStyleUrl(): string | null;
  getAttribution(): string;
  /**
   * Roads / buildings basemap experience for this source.
   * Optional — defaults to empty (no overlays) when omitted.
   */
  getExperience?(): WorldMapSourceExperience;
};

export function getMapSourceExperience(
  source: WorldMapSource | null | undefined
): WorldMapSourceExperience {
  if (!source) return createEmptyMapSourceExperience();
  try {
    const exp = source.getExperience?.();
    if (exp) return exp;
  } catch {
    // Fail-closed.
  }
  return createEmptyMapSourceExperience();
}

export function isWorldMapSourceAvailable(
  source: WorldMapSource | null | undefined
): boolean {
  if (!source) return false;
  if (!source.isAvailable()) return false;
  const url = source.getStyleUrl();
  return typeof url === "string" && url.trim().length > 0;
}
