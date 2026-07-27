import type {
  WorldCommerceRecord,
  WorldEducationRecord,
  WorldGameRecord,
  WorldUserRecord,
} from "@/src/lib/world/dataPipeline/types";
import { formatWorldCommerceKindLabel } from "@/src/lib/world/commerce";
import {
  formatWorldEducationKindLabel,
} from "@/src/lib/world/education/types";
import { formatWorldGameCategoryLabel } from "@/src/lib/world/games";
import {
  formatWorldPlaceKindLabel,
  type WorldPlace,
} from "@/src/lib/world/places/types";
import {
  WORLD_SEARCH_DEFAULT_LIMIT,
  type WorldSearchDataset,
  type WorldSearchResult,
  type WorldSearchService,
} from "@/src/lib/world/search/types";

function normalizeQuery(query: string): string {
  if (typeof query !== "string") return "";
  return query.trim().toLowerCase();
}

function includesNormalized(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle);
}

function placeToResult(place: WorldPlace): WorldSearchResult {
  const hasCoords =
    typeof place.latitude === "number" &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude);
  return {
    id: place.id,
    title: place.name,
    subtitle: place.countryName,
    kind: formatWorldPlaceKindLabel(place.kind),
    coordinates: hasCoords
      ? { latitude: place.latitude, longitude: place.longitude }
      : null,
    sourceType: "places",
  };
}

function educationToResult(row: WorldEducationRecord): WorldSearchResult {
  const hasCoords =
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude);
  const name =
    typeof row.name === "string" && row.name.trim().length > 0
      ? row.name.trim()
      : typeof row.title === "string"
        ? row.title.trim()
        : "";
  return {
    id: row.id,
    title: name,
    subtitle: row.cityName,
    kind: formatWorldEducationKindLabel(row.educationType),
    coordinates: hasCoords
      ? { latitude: row.latitude as number, longitude: row.longitude as number }
      : null,
    sourceType: "education",
  };
}

function userToResult(row: WorldUserRecord): WorldSearchResult | null {
  if (row.mapVisible !== true) return null;
  const hasCoords =
    typeof row.approximateLatitude === "number" &&
    typeof row.approximateLongitude === "number" &&
    Number.isFinite(row.approximateLatitude) &&
    Number.isFinite(row.approximateLongitude);
  return {
    id: row.id,
    title: row.displayName,
    subtitle: `@${row.handle} · ${row.cityName}`,
    kind: "User",
    coordinates: hasCoords
      ? {
          latitude: row.approximateLatitude as number,
          longitude: row.approximateLongitude as number,
        }
      : null,
    sourceType: "users",
  };
}

function gameToResult(row: WorldGameRecord): WorldSearchResult {
  const hasCoords =
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude);
  return {
    id: row.id,
    title: row.gameName,
    subtitle: `${formatWorldGameCategoryLabel(row.category)} · ${row.cityName}`,
    kind: "Game",
    coordinates: hasCoords
      ? { latitude: row.latitude as number, longitude: row.longitude as number }
      : null,
    sourceType: "games",
  };
}

function commerceToResult(row: WorldCommerceRecord): WorldSearchResult {
  const hasCoords =
    typeof row.latitude === "number" &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude);
  const brandSuffix = row.brandName ? ` · ${row.brandName}` : "";
  return {
    id: row.id,
    title: row.name,
    subtitle: `${formatWorldCommerceKindLabel(row.commerceType)} · ${row.cityName}${brandSuffix}`,
    kind: "Business",
    coordinates: hasCoords
      ? { latitude: row.latitude as number, longitude: row.longitude as number }
      : null,
    sourceType: "commerce",
  };
}

function matchPlace(place: WorldPlace, q: string): boolean {
  return (
    includesNormalized(place.name, q) ||
    includesNormalized(place.countryName, q) ||
    (typeof place.countryCode === "string" &&
      includesNormalized(place.countryCode, q)) ||
    (typeof place.stateName === "string" &&
      includesNormalized(place.stateName, q))
  );
}

function matchEducation(row: WorldEducationRecord, q: string): boolean {
  const name =
    typeof row.name === "string"
      ? row.name
      : typeof row.title === "string"
        ? row.title
        : "";
  return (
    includesNormalized(name, q) ||
    includesNormalized(row.cityName ?? "", q) ||
    includesNormalized(formatWorldEducationKindLabel(row.educationType), q)
  );
}

function matchUser(row: WorldUserRecord, q: string): boolean {
  if (row.mapVisible !== true) return false;
  return (
    includesNormalized(row.displayName ?? "", q) ||
    includesNormalized(row.handle ?? "", q) ||
    includesNormalized(`@${row.handle ?? ""}`, q)
  );
}

function matchGame(row: WorldGameRecord, q: string): boolean {
  return (
    includesNormalized(row.gameName ?? "", q) ||
    includesNormalized(row.cityName ?? "", q) ||
    includesNormalized(formatWorldGameCategoryLabel(row.category), q)
  );
}

function matchCommerce(row: WorldCommerceRecord, q: string): boolean {
  return (
    includesNormalized(row.name ?? "", q) ||
    includesNormalized(row.cityName ?? "", q) ||
    includesNormalized(formatWorldCommerceKindLabel(row.commerceType), q) ||
    (typeof row.brandName === "string" &&
      includesNormalized(row.brandName, q))
  );
}

/**
 * Pure search over Places + Education + Users + Games + Commerce.
 * Dataset must come from WorldDataPipeline-backed Runtime registries.
 */
export function createWorldSearchService(): WorldSearchService {
  return {
    search(
      query: string,
      dataset: WorldSearchDataset,
      options?: { limit?: number }
    ): WorldSearchResult[] {
      try {
        const q = normalizeQuery(query);
        if (!q) return [];

        const limit =
          typeof options?.limit === "number" && options.limit > 0
            ? Math.floor(options.limit)
            : WORLD_SEARCH_DEFAULT_LIMIT;

        const places = Array.isArray(dataset?.places) ? dataset.places : [];
        const education = Array.isArray(dataset?.education)
          ? dataset.education
          : [];
        const users = Array.isArray(dataset?.users) ? dataset.users : [];
        const games = Array.isArray(dataset?.games) ? dataset.games : [];
        const commerce = Array.isArray(dataset?.commerce)
          ? dataset.commerce
          : [];

        const results: WorldSearchResult[] = [];

        for (const place of places) {
          if (!place?.id || typeof place.name !== "string") continue;
          if (!matchPlace(place, q)) continue;
          results.push(placeToResult(place));
          if (results.length >= limit) return results;
        }

        for (const row of education) {
          if (!row?.id) continue;
          if (!matchEducation(row, q)) continue;
          const hit = educationToResult(row);
          if (!hit.title) continue;
          results.push(hit);
          if (results.length >= limit) return results;
        }

        for (const row of users) {
          if (!row?.id) continue;
          if (!matchUser(row, q)) continue;
          const hit = userToResult(row);
          if (!hit) continue;
          results.push(hit);
          if (results.length >= limit) return results;
        }

        for (const row of games) {
          if (!row?.id) continue;
          if (!matchGame(row, q)) continue;
          const hit = gameToResult(row);
          if (!hit.title) continue;
          results.push(hit);
          if (results.length >= limit) return results;
        }

        for (const row of commerce) {
          if (!row?.id) continue;
          if (!matchCommerce(row, q)) continue;
          const hit = commerceToResult(row);
          if (!hit.title) continue;
          results.push(hit);
          if (results.length >= limit) return results;
        }

        return results;
      } catch {
        return [];
      }
    },
  };
}

/**
 * Build a search dataset from Pipeline availability + registry snapshots.
 * Missing / unavailable kinds contribute [] (fail-closed, other kinds continue).
 */
export function buildWorldSearchDataset(options: {
  placesAvailable: boolean;
  educationAvailable: boolean;
  usersAvailable: boolean;
  gamesAvailable: boolean;
  commerceAvailable: boolean;
  places: WorldPlace[];
  education: WorldEducationRecord[];
  users: WorldUserRecord[];
  games: WorldGameRecord[];
  commerce: WorldCommerceRecord[];
}): WorldSearchDataset {
  return {
    places: options.placesAvailable
      ? Array.isArray(options.places)
        ? options.places
        : []
      : [],
    education: options.educationAvailable
      ? Array.isArray(options.education)
        ? options.education
        : []
      : [],
    users: options.usersAvailable
      ? Array.isArray(options.users)
        ? options.users
        : []
      : [],
    games: options.gamesAvailable
      ? Array.isArray(options.games)
        ? options.games
        : []
      : [],
    commerce: options.commerceAvailable
      ? Array.isArray(options.commerce)
        ? options.commerce
        : []
      : [],
  };
}
