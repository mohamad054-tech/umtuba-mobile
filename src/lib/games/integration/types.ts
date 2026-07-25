/**
 * UM Games ↔ mobile platform integration contracts.
 * Reuses Platform entity/destination/permission types — no duplicate entity model.
 * No engines, launchers, or gameplay implementations live here.
 */

import type {
  PlatformDestination,
  PlatformEntity,
  PlatformPermission,
  PlatformPermissionId,
} from "@/src/lib/platform";

export type GameAvailabilityState =
  | "installed"
  | "available"
  | "coming_soon"
  | "maintenance"
  | "disabled"
  | "blocked"
  | "offline"
  | "future";

export type GameLaunchMode = "internal" | "external" | "cloud" | "future";

export type GameCapabilityId =
  | "launch"
  | "leaderboards"
  | "achievements"
  | "friends"
  | "world"
  | "notifications"
  | "messages"
  | "live"
  | "learning"
  | "wallet"
  | "presence"
  | "invitations"
  | "future";

export type GamePresenceStatus =
  | "offline"
  | "online"
  | "in_game"
  | "away"
  | "future";

export type GameInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | "future";

/**
 * First-class game entity: PlatformEntity with type "game" plus games fields.
 * Callers must supply a platformEntity already parsed as type "game".
 */
export type GameEntity = {
  platformEntity: PlatformEntity;
  gameId: string;
  state: GameAvailabilityState;
  launchMode: GameLaunchMode | null;
  version: string | null;
  capabilities: GameCapabilityId[];
};

export type GameCatalogEntry = {
  gameId: string;
  title: string;
  summary: string | null;
  state: GameAvailabilityState;
  launchMode: GameLaunchMode | null;
  /** Opaque catalog key from a trusted source — never invented. */
  catalogRef: string | null;
  destination: PlatformDestination | null;
};

export type GameCapability = {
  id: GameCapabilityId;
  enabled: boolean;
};

export type GamePermission = {
  id: PlatformPermissionId;
  granted: boolean;
};

/**
 * Launch contract only — no launcher execution.
 * destination.href must already be allowlisted (or null = not launchable).
 */
export type GameLaunchContract = {
  gameId: string;
  mode: GameLaunchMode;
  /** Safe mapped destination when launch is permitted; never a fake URL. */
  destination: PlatformDestination | null;
  canLaunch: boolean;
  reason: string | null;
};

/** Opaque session reference — no fake session IDs. */
export type GameSessionReference = {
  sessionId: string;
  gameId: string;
  startedAt: string | null;
  endedAt: string | null;
};

export type GameProgressReference = {
  progressId: string;
  gameId: string;
  userId: string;
  updatedAt: string | null;
  /** Opaque progress key from backend — not invented scores. */
  progressRef: string | null;
};

export type GameAchievementReference = {
  achievementId: string;
  gameId: string;
  userId: string;
  unlockedAt: string | null;
  achievementRef: string | null;
};

export type GamePresence = {
  userId: string;
  gameId: string | null;
  status: GamePresenceStatus;
  updatedAt: string | null;
};

export type GameInvitation = {
  invitationId: string;
  gameId: string;
  fromUserId: string;
  toUserId: string;
  status: GameInvitationStatus;
  destination: PlatformDestination | null;
  createdAt: string | null;
  expiresAt: string | null;
};

export type GamesIntegrationStatus =
  | "unavailable"
  | "empty"
  | "ready"
  | "error";

export type GamesIntegrationSnapshot = {
  status: GamesIntegrationStatus;
  message: string;
  capabilities: GameCapability[];
  permissions: PlatformPermission[];
  catalog: GameCatalogEntry[];
};
