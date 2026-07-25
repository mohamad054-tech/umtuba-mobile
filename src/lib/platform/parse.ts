import { createPlatformDestination } from "@/src/lib/platform/destination";
import {
  parsePlatformActionId,
  parsePlatformCapabilityId,
  parsePlatformEntityType,
  parsePlatformModuleId,
  parsePlatformOwnership,
  parsePlatformPermissionId,
  parsePlatformVisibility,
} from "@/src/lib/platform/enums";
import type {
  PlatformAction,
  PlatformCapability,
  PlatformContext,
  PlatformEntity,
  PlatformMetadata,
  PlatformModule,
  PlatformPermission,
} from "@/src/lib/platform/types";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parsePlatformMetadata(raw: unknown): PlatformMetadata | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const bag: PlatformMetadata = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
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
  return bag;
}

export function parsePlatformPermission(raw: unknown): PlatformPermission | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parsePlatformPermissionId(
    cleanText(r.id) ?? cleanText(r.permission)
  );
  if (!id) return null;
  return { id, granted: r.granted === true };
}

export function parsePlatformAction(raw: unknown): PlatformAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parsePlatformActionId(cleanText(r.id) ?? cleanText(r.action));
  if (!id) return null;

  const destinationRaw =
    cleanText(r.destination) ??
    cleanText(r.href) ??
    (r.destination && typeof r.destination === "object"
      ? cleanText((r.destination as { raw?: unknown }).raw)
      : null);

  return {
    id,
    label: cleanText(r.label),
    enabled: r.enabled === true,
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
  };
}

export function parsePlatformCapability(raw: unknown): PlatformCapability | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parsePlatformCapabilityId(
    cleanText(r.id) ?? cleanText(r.capability)
  );
  if (!id) return null;
  return { id, enabled: r.enabled === true };
}

export function parsePlatformModule(raw: unknown): PlatformModule | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parsePlatformModuleId(cleanText(r.id) ?? cleanText(r.module));
  const label = cleanText(r.label);
  if (!id || !label) return null;
  return { id, label, available: r.available === true };
}

/**
 * Fail-closed entity parse. Unknown type/visibility/ownership rejected.
 * No invented titles or sample entities.
 */
export function parsePlatformEntity(raw: unknown): PlatformEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = cleanText(r.id);
  const type = parsePlatformEntityType(
    cleanText(r.type) ?? cleanText(r.entity_type)
  );
  const title = cleanText(r.title) ?? cleanText(r.name);
  const visibility = parsePlatformVisibility(cleanText(r.visibility));
  const ownership = parsePlatformOwnership(cleanText(r.ownership));
  if (!id || !type || !title || !visibility || !ownership) return null;

  const metadata = parsePlatformMetadata(r.metadata ?? {});
  if (!metadata) return null;

  const destinationRaw =
    cleanText(r.destination) ??
    cleanText(r.href) ??
    (r.destination && typeof r.destination === "object"
      ? cleanText((r.destination as { raw?: unknown }).raw)
      : null);

  return {
    id,
    type,
    title,
    subtitle: cleanText(r.subtitle) ?? cleanText(r.description),
    module: parsePlatformModuleId(cleanText(r.module) ?? cleanText(r.module_id)),
    visibility,
    ownership,
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
    metadata,
  };
}

export function parsePlatformEntities(rows: unknown): PlatformEntity[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(parsePlatformEntity)
    .filter((e): e is PlatformEntity => Boolean(e));
}

export function parsePlatformContext(raw: unknown): PlatformContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const permissionsRaw = Array.isArray(r.permissions) ? r.permissions : [];
  const permissions = permissionsRaw
    .map(parsePlatformPermission)
    .filter((p): p is PlatformPermission => Boolean(p));

  return {
    userId: cleanText(r.userId) ?? cleanText(r.user_id),
    module: parsePlatformModuleId(cleanText(r.module) ?? cleanText(r.module_id)),
    locale: cleanText(r.locale),
    permissions,
  };
}

export function emptyPlatformContext(): PlatformContext {
  return {
    userId: null,
    module: null,
    locale: null,
    permissions: [],
  };
}

export function hasPlatformPermission(
  permissions: PlatformPermission[],
  id: PlatformPermission["id"]
): boolean {
  return permissions.some((p) => p.id === id && p.granted);
}
