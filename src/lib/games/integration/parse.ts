import {
  parseGameAvailabilityState,
  parseGameCapabilityId,
  parseGameInvitationStatus,
  parseGameLaunchMode,
  parseGamePresenceStatus,
} from "@/src/lib/games/integration/enums";
import type {
  GameAchievementReference,
  GameCapability,
  GameCatalogEntry,
  GameEntity,
  GameInvitation,
  GameLaunchContract,
  GamePresence,
  GameProgressReference,
  GameSessionReference,
} from "@/src/lib/games/integration/types";
import {
  createPlatformDestination,
  parsePlatformEntity,
  parsePlatformPermission,
  type PlatformEntity,
  type PlatformPermission,
} from "@/src/lib/platform";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanIso(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) return null;
  return text;
}

function parseCapabilityList(raw: unknown): GameCapability["id"][] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: GameCapability["id"][] = [];
  for (const item of raw) {
    const id =
      typeof item === "string"
        ? parseGameCapabilityId(item)
        : item && typeof item === "object"
          ? parseGameCapabilityId(
              cleanText((item as { id?: unknown }).id)
            )
          : null;
    if (!id) return null;
    out.push(id);
  }
  return out;
}

/**
 * Build a GameEntity from a trusted PlatformEntity (type must be "game").
 */
export function toGameEntity(
  platformEntity: PlatformEntity,
  extras: {
    gameId: string;
    state: string;
    launchMode?: string | null;
    version?: string | null;
    capabilities?: unknown;
  }
): GameEntity | null {
  if (platformEntity.type !== "game") return null;
  const gameId = cleanText(extras.gameId);
  const state = parseGameAvailabilityState(extras.state);
  if (!gameId || !state) return null;

  const capabilities = parseCapabilityList(extras.capabilities ?? []);
  if (!capabilities) return null;

  const launchMode =
    extras.launchMode == null || extras.launchMode === ""
      ? null
      : parseGameLaunchMode(extras.launchMode);
  if (extras.launchMode && !launchMode) return null;

  return {
    platformEntity,
    gameId,
    state,
    launchMode,
    version: cleanText(extras.version ?? null),
    capabilities,
  };
}

/**
 * Parse a game entity payload that embeds platform entity fields.
 * Does not invent game IDs or titles.
 */
export function parseGameEntity(raw: unknown): GameEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const platformRaw =
    r.platformEntity && typeof r.platformEntity === "object"
      ? r.platformEntity
      : {
          id: r.id,
          type: r.type ?? "game",
          title: r.title ?? r.name,
          subtitle: r.subtitle ?? r.summary,
          module: r.module ?? "games",
          visibility: r.visibility ?? "public",
          ownership: r.ownership ?? "system",
          destination: r.destination ?? r.href,
          metadata: r.metadata ?? {},
        };

  const platformEntity = parsePlatformEntity(platformRaw);
  if (!platformEntity) return null;

  return toGameEntity(platformEntity, {
    gameId: cleanText(r.gameId) ?? cleanText(r.game_id) ?? platformEntity.id,
    state: cleanText(r.state) ?? cleanText(r.availability) ?? "",
    launchMode: cleanText(r.launchMode) ?? cleanText(r.launch_mode),
    version: cleanText(r.version),
    capabilities: r.capabilities,
  });
}

export function parseGameCatalogEntry(raw: unknown): GameCatalogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const gameId = cleanText(r.gameId) ?? cleanText(r.game_id);
  const title = cleanText(r.title) ?? cleanText(r.name);
  const state = parseGameAvailabilityState(
    cleanText(r.state) ?? cleanText(r.availability)
  );
  if (!gameId || !title || !state) return null;

  const launchModeRaw = cleanText(r.launchMode) ?? cleanText(r.launch_mode);
  const launchMode = launchModeRaw ? parseGameLaunchMode(launchModeRaw) : null;
  if (launchModeRaw && !launchMode) return null;

  const destinationRaw = cleanText(r.destination) ?? cleanText(r.href);

  return {
    gameId,
    title,
    summary: cleanText(r.summary) ?? cleanText(r.description),
    state,
    launchMode,
    catalogRef: cleanText(r.catalogRef) ?? cleanText(r.catalog_ref),
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
  };
}

export function parseGameCapability(raw: unknown): GameCapability | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parseGameCapabilityId(cleanText(r.id) ?? cleanText(r.capability));
  if (!id) return null;
  return { id, enabled: r.enabled === true };
}

/**
 * Safe launch contract. Never invents URLs or enables launch without allowlisted href.
 */
export function resolveGameLaunchContract(input: {
  gameId: string;
  mode: string | null | undefined;
  destinationRaw?: string | null;
  state?: string | null;
}): GameLaunchContract | null {
  const gameId = cleanText(input.gameId);
  const mode = parseGameLaunchMode(input.mode);
  if (!gameId || !mode) return null;

  const state = input.state
    ? parseGameAvailabilityState(input.state)
    : "available";
  if (!state) return null;

  const destination = input.destinationRaw
    ? createPlatformDestination(input.destinationRaw)
    : null;

  const blockedStates = new Set([
    "coming_soon",
    "maintenance",
    "disabled",
    "blocked",
    "offline",
    "future",
  ]);

  if (blockedStates.has(state)) {
    return {
      gameId,
      mode,
      destination,
      canLaunch: false,
      reason: `Game is ${state.split("_").join(" ")}.`,
    };
  }

  if (!destination || !destination.href) {
    return {
      gameId,
      mode,
      destination,
      canLaunch: false,
      reason: "No safe launch destination is available.",
    };
  }

  // Foundation: contract may be valid structurally, but launcher is not bound.
  return {
    gameId,
    mode,
    destination,
    canLaunch: false,
    reason: "Game launching is not available yet.",
  };
}

export function parseGameSessionReference(
  raw: unknown
): GameSessionReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const sessionId = cleanText(r.sessionId) ?? cleanText(r.session_id);
  const gameId = cleanText(r.gameId) ?? cleanText(r.game_id);
  if (!sessionId || !gameId) return null;
  return {
    sessionId,
    gameId,
    startedAt: cleanIso(r.startedAt) ?? cleanIso(r.started_at),
    endedAt: cleanIso(r.endedAt) ?? cleanIso(r.ended_at),
  };
}

export function parseGameProgressReference(
  raw: unknown
): GameProgressReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const progressId = cleanText(r.progressId) ?? cleanText(r.progress_id);
  const gameId = cleanText(r.gameId) ?? cleanText(r.game_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!progressId || !gameId || !userId) return null;
  return {
    progressId,
    gameId,
    userId,
    updatedAt: cleanIso(r.updatedAt) ?? cleanIso(r.updated_at),
    progressRef: cleanText(r.progressRef) ?? cleanText(r.progress_ref),
  };
}

export function parseGameAchievementReference(
  raw: unknown
): GameAchievementReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const achievementId =
    cleanText(r.achievementId) ?? cleanText(r.achievement_id);
  const gameId = cleanText(r.gameId) ?? cleanText(r.game_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!achievementId || !gameId || !userId) return null;
  return {
    achievementId,
    gameId,
    userId,
    unlockedAt: cleanIso(r.unlockedAt) ?? cleanIso(r.unlocked_at),
    achievementRef:
      cleanText(r.achievementRef) ?? cleanText(r.achievement_ref),
  };
}

export function parseGamePresence(raw: unknown): GamePresence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  const status = parseGamePresenceStatus(cleanText(r.status));
  if (!userId || !status) return null;
  return {
    userId,
    gameId: cleanText(r.gameId) ?? cleanText(r.game_id),
    status,
    updatedAt: cleanIso(r.updatedAt) ?? cleanIso(r.updated_at),
  };
}

export function parseGameInvitation(raw: unknown): GameInvitation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const invitationId =
    cleanText(r.invitationId) ?? cleanText(r.invitation_id);
  const gameId = cleanText(r.gameId) ?? cleanText(r.game_id);
  const fromUserId = cleanText(r.fromUserId) ?? cleanText(r.from_user_id);
  const toUserId = cleanText(r.toUserId) ?? cleanText(r.to_user_id);
  const status = parseGameInvitationStatus(cleanText(r.status));
  if (!invitationId || !gameId || !fromUserId || !toUserId || !status) {
    return null;
  }
  const destinationRaw = cleanText(r.destination) ?? cleanText(r.href);
  return {
    invitationId,
    gameId,
    fromUserId,
    toUserId,
    status,
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
    createdAt: cleanIso(r.createdAt) ?? cleanIso(r.created_at),
    expiresAt: cleanIso(r.expiresAt) ?? cleanIso(r.expires_at),
  };
}

export function parseGamePermissions(raw: unknown): PlatformPermission[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parsePlatformPermission)
    .filter((p): p is PlatformPermission => Boolean(p));
}
