export {
  isGameLauncherBound,
  isGamesIntegrationAdapterBound,
  type GameCatalogAdapter,
  type GameEntityAdapter,
  type GameLaunchAdapter,
  type GamesIntegrationAdapter,
} from "@/src/lib/games/integration/adapters";
export {
  parseGameAchievementReference,
  parseGameCapability,
  parseGameCatalogEntry,
  parseGameEntity,
  parseGameInvitation,
  parseGamePermissions,
  parseGamePresence,
  parseGameProgressReference,
  parseGameSessionReference,
  resolveGameLaunchContract,
  toGameEntity,
} from "@/src/lib/games/integration/parse";
export {
  parseGameAvailabilityState,
  parseGameCapabilityId,
  parseGameInvitationStatus,
  parseGameLaunchMode,
  parseGamePresenceStatus,
} from "@/src/lib/games/integration/enums";
export {
  defaultGamePermissions,
  getGamesIntegrationSnapshot,
  isGamesIntegrationConfigured,
  listGameCapabilities,
} from "@/src/lib/games/integration/foundation";
export type {
  GameAchievementReference,
  GameAvailabilityState,
  GameCapability,
  GameCapabilityId,
  GameCatalogEntry,
  GameEntity,
  GameInvitation,
  GameInvitationStatus,
  GameLaunchContract,
  GameLaunchMode,
  GamePermission,
  GamePresence,
  GamePresenceStatus,
  GameProgressReference,
  GameSessionReference,
  GamesIntegrationSnapshot,
  GamesIntegrationStatus,
} from "@/src/lib/games/integration/types";
