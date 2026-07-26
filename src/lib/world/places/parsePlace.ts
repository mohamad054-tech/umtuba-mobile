import {
  isValidLatitude,
  isValidLongitude,
} from "@/src/lib/world/camera";
import type {
  WorldPlace,
  WorldPlaceCityTier,
  WorldPlaceKind,
} from "@/src/lib/world/places/types";

const PLACE_KINDS = new Set<WorldPlaceKind>([
  "country",
  "state",
  "city",
  "capital",
]);

const CITY_TIERS = new Set<WorldPlaceCityTier>(["capital", "major", "minor"]);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWorldPlaceKind(
  raw: string | null | undefined
): WorldPlaceKind | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldPlaceKind;
  return PLACE_KINDS.has(key) ? key : null;
}

function parseCityTier(raw: unknown): WorldPlaceCityTier | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldPlaceCityTier;
  return CITY_TIERS.has(key) ? key : null;
}

/**
 * Parse a place. Invalid kind/coords/name fail closed (null).
 */
export function parseWorldPlace(raw: unknown): WorldPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = cleanText(r.id);
  const kind = parseWorldPlaceKind(cleanText(r.kind) ?? cleanText(r.type));
  const name = cleanText(r.name) ?? cleanText(r.title);
  const countryName =
    cleanText(r.countryName) ?? cleanText(r.country) ?? cleanText(r.country_name);
  if (!id || !kind || !name || !countryName) return null;
  if (
    typeof r.latitude !== "number" ||
    typeof r.longitude !== "number" ||
    !isValidLatitude(r.latitude) ||
    !isValidLongitude(r.longitude)
  ) {
    return null;
  }

  return {
    id,
    kind,
    name,
    countryName,
    countryCode: cleanText(r.countryCode) ?? cleanText(r.country_code),
    stateName:
      cleanText(r.stateName) ?? cleanText(r.state) ?? cleanText(r.province),
    latitude: r.latitude,
    longitude: r.longitude,
    cityTier: parseCityTier(r.cityTier ?? r.city_tier ?? r.tier),
  };
}

export function parseWorldPlaces(rows: unknown): WorldPlace[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(parseWorldPlace)
    .filter((p): p is WorldPlace => Boolean(p));
}
