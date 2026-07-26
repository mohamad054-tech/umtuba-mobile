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

/** User presence / profile pins — empty until a real provider binds. */
export type WorldUserRecord = {
  id: string;
  displayName: string;
  latitude: number | null;
  longitude: number | null;
};

/** Education nodes — empty until a real provider binds. */
export type WorldEducationRecord = {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
};

/** Games nodes — empty until a real provider binds. */
export type WorldGameRecord = {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
};

/** Commerce nodes — empty until a real provider binds. */
export type WorldCommerceRecord = {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
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
