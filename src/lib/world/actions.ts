import { parseWorldCategoryId } from "@/src/lib/world/categories";
import { parseWorldViewport } from "@/src/lib/world/camera";
import type {
  WorldAction,
  WorldActionKind,
  WorldFilter,
  WorldPermission,
  WorldPermissionId,
} from "@/src/lib/world/types";

const ACTION_KINDS = new Set<WorldActionKind>([
  "open_entity",
  "focus_camera",
  "toggle_layer",
  "apply_filter",
  "navigate",
]);

const PERMISSION_IDS = new Set<WorldPermissionId>([
  "view_world",
  "view_users",
  "view_precise_location",
  "place_pin",
  "edit_overlay",
]);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWorldActionKind(
  raw: string | null | undefined
): WorldActionKind | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldActionKind;
  return ACTION_KINDS.has(key) ? key : null;
}

export function parseWorldPermissionId(
  raw: string | null | undefined
): WorldPermissionId | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldPermissionId;
  return PERMISSION_IDS.has(key) ? key : null;
}

export function parseWorldFilter(raw: unknown): WorldFilter | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const categoriesRaw = Array.isArray(r.categories) ? r.categories : [];
  const categories = categoriesRaw
    .map((c) => parseWorldCategoryId(typeof c === "string" ? c : null))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const bbox =
    r.bbox == null ? null : parseWorldViewport(r.bbox);
  if (r.bbox != null && bbox == null) return null;

  return {
    categories,
    query: cleanText(r.query),
    bbox,
  };
}

export function emptyWorldFilter(): WorldFilter {
  return { categories: [], query: null, bbox: null };
}

export function parseWorldAction(raw: unknown): WorldAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = parseWorldActionKind(cleanText(r.kind) ?? cleanText(r.type));
  if (!kind) return null;

  let payload: WorldAction["payload"] = null;
  if (r.payload != null) {
    if (typeof r.payload !== "object" || Array.isArray(r.payload)) return null;
    const bag: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(
      r.payload as Record<string, unknown>
    )) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        bag[key] = value;
      } else {
        return null;
      }
    }
    payload = bag;
  }

  return {
    kind,
    targetId: cleanText(r.targetId) ?? cleanText(r.target_id),
    payload,
  };
}

export function parseWorldPermission(raw: unknown): WorldPermission | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parseWorldPermissionId(cleanText(r.id) ?? cleanText(r.permission));
  if (!id) return null;
  return { id, granted: r.granted === true };
}

export function defaultWorldPermissions(): WorldPermission[] {
  // Foundation: no World product permissions granted until backend contracts exist.
  return [
    { id: "view_world", granted: false },
    { id: "view_users", granted: false },
    { id: "view_precise_location", granted: false },
    { id: "place_pin", granted: false },
    { id: "edit_overlay", granted: false },
  ];
}

export function hasWorldPermission(
  permissions: WorldPermission[],
  id: WorldPermissionId
): boolean {
  return permissions.some((p) => p.id === id && p.granted);
}
