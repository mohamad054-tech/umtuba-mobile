import type {
  PlatformActionId,
  PlatformCapabilityId,
  PlatformEntityType,
  PlatformModuleId,
  PlatformOwnership,
  PlatformPermissionId,
  PlatformVisibility,
} from "@/src/lib/platform/types";

const ENTITY_TYPES = new Set<PlatformEntityType>([
  "user",
  "video",
  "course",
  "lesson",
  "game",
  "live",
  "message",
  "conversation",
  "notification",
  "event",
  "city",
  "business",
  "world",
  "reward",
  "future",
]);

const ACTION_IDS = new Set<PlatformActionId>([
  "open",
  "share",
  "save",
  "follow",
  "join",
  "start",
  "resume",
  "report",
  "delete",
  "edit",
  "mute",
  "archive",
  "future",
]);

const PERMISSION_IDS = new Set<PlatformPermissionId>([
  "view",
  "edit",
  "delete",
  "share",
  "join",
  "host",
  "moderate",
  "admin",
  "future",
]);

const VISIBILITIES = new Set<PlatformVisibility>([
  "public",
  "private",
  "followers",
  "organization",
  "system",
  "future",
]);

const OWNERSHIPS = new Set<PlatformOwnership>([
  "self",
  "organization",
  "system",
  "external",
  "future",
]);

const MODULE_IDS = new Set<PlatformModuleId>([
  "watch",
  "discover",
  "messages",
  "live",
  "world",
  "learning",
  "games",
  "notifications",
  "rewards",
  "profile",
  "settings",
  "future",
]);

const CAPABILITY_IDS = new Set<PlatformCapabilityId>([
  "navigate",
  "share",
  "persist",
  "realtime",
  "media_playback",
  "live_join",
  "world_render",
  "future",
]);

function normalizeKey(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return key.length > 0 ? key : null;
}

export function parsePlatformEntityType(
  raw: string | null | undefined
): PlatformEntityType | null {
  const key = normalizeKey(raw);
  if (!key || !ENTITY_TYPES.has(key as PlatformEntityType)) return null;
  return key as PlatformEntityType;
}

export function parsePlatformActionId(
  raw: string | null | undefined
): PlatformActionId | null {
  const key = normalizeKey(raw);
  if (!key || !ACTION_IDS.has(key as PlatformActionId)) return null;
  return key as PlatformActionId;
}

export function parsePlatformPermissionId(
  raw: string | null | undefined
): PlatformPermissionId | null {
  const key = normalizeKey(raw);
  if (!key || !PERMISSION_IDS.has(key as PlatformPermissionId)) return null;
  return key as PlatformPermissionId;
}

export function parsePlatformVisibility(
  raw: string | null | undefined
): PlatformVisibility | null {
  const key = normalizeKey(raw);
  if (!key || !VISIBILITIES.has(key as PlatformVisibility)) return null;
  return key as PlatformVisibility;
}

export function parsePlatformOwnership(
  raw: string | null | undefined
): PlatformOwnership | null {
  const key = normalizeKey(raw);
  if (!key || !OWNERSHIPS.has(key as PlatformOwnership)) return null;
  return key as PlatformOwnership;
}

export function parsePlatformModuleId(
  raw: string | null | undefined
): PlatformModuleId | null {
  const key = normalizeKey(raw);
  if (!key || !MODULE_IDS.has(key as PlatformModuleId)) return null;
  return key as PlatformModuleId;
}

export function parsePlatformCapabilityId(
  raw: string | null | undefined
): PlatformCapabilityId | null {
  const key = normalizeKey(raw);
  if (!key || !CAPABILITY_IDS.has(key as PlatformCapabilityId)) return null;
  return key as PlatformCapabilityId;
}
