import { parseWorldCategoryId } from "@/src/lib/world/categories";
import {
  isValidLatitude,
  isValidLongitude,
} from "@/src/lib/world/camera";
import type { WorldEntity, WorldEntityKind } from "@/src/lib/world/types";

const ENTITY_KINDS = new Set<WorldEntityKind>([
  "user",
  "city",
  "education",
  "game",
  "event",
  "business",
  "ai",
  "other",
]);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWorldEntityKind(
  raw: string | null | undefined
): WorldEntityKind | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldEntityKind;
  return ENTITY_KINDS.has(key) ? key : null;
}

/**
 * Parse a World entity. Unknown kinds/categories are rejected.
 * Missing title/id fails closed. Coordinates optional but must be valid if present.
 */
export function parseWorldEntity(raw: unknown): WorldEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = cleanText(r.id);
  const kind = parseWorldEntityKind(cleanText(r.kind) ?? cleanText(r.type));
  const category = parseWorldCategoryId(
    cleanText(r.category) ?? cleanText(r.category_id)
  );
  const title = cleanText(r.title) ?? cleanText(r.name);
  if (!id || !kind || !category || !title) return null;

  let latitude: number | null = null;
  let longitude: number | null = null;
  if (r.latitude != null || r.longitude != null) {
    if (
      typeof r.latitude !== "number" ||
      typeof r.longitude !== "number" ||
      !isValidLatitude(r.latitude) ||
      !isValidLongitude(r.longitude)
    ) {
      return null;
    }
    latitude = r.latitude;
    longitude = r.longitude;
  }

  return {
    id,
    kind,
    category,
    title,
    subtitle: cleanText(r.subtitle) ?? cleanText(r.description),
    latitude,
    longitude,
    destination: cleanText(r.destination) ?? cleanText(r.href),
  };
}

export function parseWorldEntities(rows: unknown): WorldEntity[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(parseWorldEntity)
    .filter((e): e is WorldEntity => Boolean(e));
}
