/**
 * World Map Source Foundation — tile/style providers independent of renderers.
 * Renderers must not hardcode tile URLs; Runtime resolves sources via Registry.
 */

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
};

export function isWorldMapSourceAvailable(
  source: WorldMapSource | null | undefined
): boolean {
  if (!source) return false;
  if (!source.isAvailable()) return false;
  const url = source.getStyleUrl();
  return typeof url === "string" && url.trim().length > 0;
}
