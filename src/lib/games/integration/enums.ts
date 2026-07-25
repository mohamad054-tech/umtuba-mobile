import type {
  GameAvailabilityState,
  GameCapabilityId,
  GameInvitationStatus,
  GameLaunchMode,
  GamePresenceStatus,
} from "@/src/lib/games/integration/types";

const STATES = new Set<GameAvailabilityState>([
  "installed",
  "available",
  "coming_soon",
  "maintenance",
  "disabled",
  "blocked",
  "offline",
  "future",
]);

const LAUNCH_MODES = new Set<GameLaunchMode>([
  "internal",
  "external",
  "cloud",
  "future",
]);

const CAPABILITIES = new Set<GameCapabilityId>([
  "launch",
  "leaderboards",
  "achievements",
  "friends",
  "world",
  "notifications",
  "messages",
  "live",
  "learning",
  "wallet",
  "presence",
  "invitations",
  "future",
]);

const PRESENCE = new Set<GamePresenceStatus>([
  "offline",
  "online",
  "in_game",
  "away",
  "future",
]);

const INVITES = new Set<GameInvitationStatus>([
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "future",
]);

function normalize(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return key.length > 0 ? key : null;
}

export function parseGameAvailabilityState(
  raw: string | null | undefined
): GameAvailabilityState | null {
  const key = normalize(raw);
  if (!key || !STATES.has(key as GameAvailabilityState)) return null;
  return key as GameAvailabilityState;
}

export function parseGameLaunchMode(
  raw: string | null | undefined
): GameLaunchMode | null {
  const key = normalize(raw);
  if (!key || !LAUNCH_MODES.has(key as GameLaunchMode)) return null;
  return key as GameLaunchMode;
}

export function parseGameCapabilityId(
  raw: string | null | undefined
): GameCapabilityId | null {
  const key = normalize(raw);
  if (!key || !CAPABILITIES.has(key as GameCapabilityId)) return null;
  return key as GameCapabilityId;
}

export function parseGamePresenceStatus(
  raw: string | null | undefined
): GamePresenceStatus | null {
  const key = normalize(raw);
  if (!key || !PRESENCE.has(key as GamePresenceStatus)) return null;
  return key as GamePresenceStatus;
}

export function parseGameInvitationStatus(
  raw: string | null | undefined
): GameInvitationStatus | null {
  const key = normalize(raw);
  if (!key || !INVITES.has(key as GameInvitationStatus)) return null;
  return key as GameInvitationStatus;
}
