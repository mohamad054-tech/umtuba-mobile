/**
 * World Places Foundation — place data independent of map SDKs.
 */

export type WorldPlaceKind = "country" | "state" | "city" | "capital";

export type WorldPlaceCityTier = "capital" | "major" | "minor";

/**
 * A named place with coordinates.
 * Coordinates are only present when a trusted provider supplies them.
 */
export type WorldPlace = {
  id: string;
  kind: WorldPlaceKind;
  name: string;
  countryName: string;
  countryCode: string | null;
  stateName: string | null;
  latitude: number;
  longitude: number;
  /**
   * Display tier for Places UX layers (Capitals / Major / Minor).
   * When omitted, derived from `kind` (capital → capital, city → major).
   */
  cityTier?: WorldPlaceCityTier | null;
};

/**
 * Provider-agnostic places contract.
 * Implementations must not import MapLibre / Mapbox / Google Maps.
 */
export type WorldPlaceProvider = {
  readonly id: string;
  isAvailable(): boolean;
  listPlaces(): Promise<WorldPlace[]>;
};

export const WORLD_PLACES_LAYER_ID = "cities" as const;

export function isWorldPlaceProviderAvailable(
  provider: WorldPlaceProvider | null | undefined
): boolean {
  return provider?.isAvailable() === true;
}

export function formatWorldPlaceKindLabel(kind: WorldPlaceKind): string {
  switch (kind) {
    case "country":
      return "Country";
    case "state":
      return "State / Province";
    case "city":
      return "City";
    case "capital":
      return "Capital";
    default:
      return "Place";
  }
}
