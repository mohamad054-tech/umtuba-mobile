import { parseWorldCategoryId } from "@/src/lib/world/categories";
import type {
  WorldLayer,
  WorldLayerKind,
  WorldOverlay,
  WorldOverlayKind,
  WorldPin,
} from "@/src/lib/world/types";
import {
  isValidLatitude,
  isValidLongitude,
} from "@/src/lib/world/camera";

const LAYER_KINDS = new Set<WorldLayerKind>([
  "basemap",
  "pins",
  "overlays",
  "heatmap",
  "routes",
]);

const OVERLAY_KINDS = new Set<WorldOverlayKind>([
  "geojson",
  "polygon",
  "polyline",
  "label",
]);

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseWorldLayerKind(
  raw: string | null | undefined
): WorldLayerKind | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldLayerKind;
  return LAYER_KINDS.has(key) ? key : null;
}

export function parseWorldOverlayKind(
  raw: string | null | undefined
): WorldOverlayKind | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase() as WorldOverlayKind;
  return OVERLAY_KINDS.has(key) ? key : null;
}

/** Unknown layer kinds are rejected (fail closed). */
export function parseWorldLayer(raw: unknown): WorldLayer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = cleanText(r.id);
  const kind = parseWorldLayerKind(cleanText(r.kind));
  const label = cleanText(r.label);
  if (!id || !kind || !label) return null;

  const zIndex =
    typeof r.zIndex === "number" && Number.isFinite(r.zIndex)
      ? Math.trunc(r.zIndex)
      : typeof r.z_index === "number" && Number.isFinite(r.z_index)
        ? Math.trunc(r.z_index)
        : 0;

  return {
    id,
    kind,
    category: parseWorldCategoryId(
      cleanText(r.category) ?? cleanText(r.category_id)
    ),
    label,
    visible: r.visible === true,
    interactive: r.interactive === true,
    zIndex,
    sourceRef: cleanText(r.sourceRef) ?? cleanText(r.source_ref),
  };
}

export function parseWorldPin(raw: unknown): WorldPin | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = cleanText(r.id);
  const entityId = cleanText(r.entityId) ?? cleanText(r.entity_id);
  const category = parseWorldCategoryId(
    cleanText(r.category) ?? cleanText(r.category_id)
  );
  const latitude = r.latitude;
  const longitude = r.longitude;
  if (!id || !entityId || !category) return null;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !isValidLatitude(latitude) ||
    !isValidLongitude(longitude)
  ) {
    return null;
  }

  return {
    id,
    entityId,
    latitude,
    longitude,
    title: cleanText(r.title),
    category,
    destination: cleanText(r.destination) ?? cleanText(r.href),
  };
}

export function parseWorldOverlay(raw: unknown): WorldOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = cleanText(r.id);
  const kind = parseWorldOverlayKind(cleanText(r.kind));
  if (!id || !kind) return null;

  return {
    id,
    kind,
    entityId: cleanText(r.entityId) ?? cleanText(r.entity_id),
    category: parseWorldCategoryId(
      cleanText(r.category) ?? cleanText(r.category_id)
    ),
    payloadRef: cleanText(r.payloadRef) ?? cleanText(r.payload_ref),
  };
}
