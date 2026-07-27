/**
 * World Data Pipeline Foundation — unified data kinds for UM World.
 * Providers must not import MapLibre / Mapbox / Google Maps / Cesium / PMTiles.
 */

import type { WorldPlace } from "@/src/lib/world/places/types";

export type WorldDataKind =
  | "places"
  | "users"
  | "education"
  | "games"
  | "commerce"
  | "events";

export const WORLD_DATA_KINDS: readonly WorldDataKind[] = [
  "places",
  "users",
  "education",
  "games",
  "commerce",
  "events",
] as const;

/** Place rows reuse the Places foundation contract. */
export type WorldPlacesData = WorldPlace;

/** User presence pins — approximate city-level only; never precise GPS. */
export type WorldUserPresence = "online" | "active_recently" | null;

export type WorldUserRecord = {
  id: string;
  displayName: string;
  handle: string;
  cityName: string;
  /**
   * Approximate public pin (city-level fuzz).
   * Never a precise home / device GPS coordinate.
   */
  approximateLatitude: number | null;
  approximateLongitude: number | null;
  /** When false, user is omitted from map, search, and sheets (privacy). */
  mapVisible: boolean;
  presence: WorldUserPresence;
};

/** Education nodes — provider-backed learning places on the World map. */
export type WorldEducationKind =
  | "university"
  | "school"
  | "learning_center";

export type WorldEducationRecord = {
  id: string;
  name: string;
  /** @deprecated Prefer `name` — kept for pipeline compatibility during transition. */
  title?: string;
  educationType: WorldEducationKind;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
};

export type WorldGameCategory =
  | "casual_game"
  | "multiplayer_game"
  | "tournament"
  | "game_hub";

/** Games nodes — provider-backed map points. */
export type WorldGameRecord = {
  id: string;
  gameName: string;
  /** @deprecated Prefer `gameName`; kept for transition compatibility. */
  title?: string;
  category: WorldGameCategory;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
};

export type WorldCommerceKind =
  | "store"
  | "restaurant"
  | "market"
  | "service"
  | "seller_hub";

/** Commerce nodes — provider-backed map points. */
export type WorldCommerceRecord = {
  id: string;
  name: string;
  /** @deprecated Prefer `name` — kept for pipeline compatibility during transition. */
  title?: string;
  commerceType: WorldCommerceKind;
  cityName: string;
  /** Public brand/seller display name when allowed; never private address/phone/email */
  brandName: string | null;
  latitude: number | null;
  longitude: number | null;
  /** When false, omit from map/search/sheets */
  mapVisible: boolean;
  published: boolean;
};

/** Event nodes — empty until a real provider binds. */
export type WorldEventRecord = {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
};

export type WorldDataProviderBase = {
  readonly id: string;
  readonly kind: WorldDataKind;
  isAvailable(): boolean;
};

export type WorldPlacesDataProvider = WorldDataProviderBase & {
  readonly kind: "places";
  listPlaces(): Promise<WorldPlace[]>;
};

export type WorldUsersDataProvider = WorldDataProviderBase & {
  readonly kind: "users";
  listUsers(): Promise<WorldUserRecord[]>;
};

export type WorldEducationDataProvider = WorldDataProviderBase & {
  readonly kind: "education";
  listEducation(): Promise<WorldEducationRecord[]>;
};

export type WorldGamesDataProvider = WorldDataProviderBase & {
  readonly kind: "games";
  listGames(): Promise<WorldGameRecord[]>;
};

export type WorldCommerceDataProvider = WorldDataProviderBase & {
  readonly kind: "commerce";
  listCommerce(): Promise<WorldCommerceRecord[]>;
};

export type WorldEventsDataProvider = WorldDataProviderBase & {
  readonly kind: "events";
  listEvents(): Promise<WorldEventRecord[]>;
};

export type WorldDataProvider =
  | WorldPlacesDataProvider
  | WorldUsersDataProvider
  | WorldEducationDataProvider
  | WorldGamesDataProvider
  | WorldCommerceDataProvider
  | WorldEventsDataProvider;

export type WorldDataBundle = {
  places: WorldPlace[];
  users: WorldUserRecord[];
  education: WorldEducationRecord[];
  games: WorldGameRecord[];
  commerce: WorldCommerceRecord[];
  events: WorldEventRecord[];
};

export function emptyWorldDataBundle(): WorldDataBundle {
  return {
    places: [],
    users: [],
    education: [],
    games: [],
    commerce: [],
    events: [],
  };
}

export function isWorldDataProviderAvailable(
  provider: WorldDataProvider | null | undefined
): boolean {
  return provider?.isAvailable() === true;
}

export function isWorldDataKind(value: unknown): value is WorldDataKind {
  return (
    typeof value === "string" &&
    (WORLD_DATA_KINDS as readonly string[]).includes(value)
  );
}
