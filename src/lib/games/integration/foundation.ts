import type {
  GameCapability,
  GamesIntegrationSnapshot,
} from "@/src/lib/games/integration/types";
import type { PlatformPermission } from "@/src/lib/platform";

/**
 * Declared integration capabilities — all disabled until adapters/backends bind.
 */
export function listGameCapabilities(): GameCapability[] {
  return [
    { id: "launch", enabled: false },
    { id: "leaderboards", enabled: false },
    { id: "achievements", enabled: false },
    { id: "friends", enabled: false },
    { id: "world", enabled: false },
    { id: "notifications", enabled: false },
    { id: "messages", enabled: false },
    { id: "live", enabled: false },
    { id: "learning", enabled: false },
    { id: "wallet", enabled: false },
    { id: "presence", enabled: false },
    { id: "invitations", enabled: false },
    { id: "future", enabled: false },
  ];
}

export function defaultGamePermissions(): PlatformPermission[] {
  return [
    { id: "view", granted: false },
    { id: "join", granted: false },
    { id: "share", granted: false },
    { id: "host", granted: false },
    { id: "moderate", granted: false },
  ];
}

export function isGamesIntegrationConfigured(): boolean {
  return false;
}

/**
 * Fail-closed snapshot — empty catalog, no fake games.
 */
export function getGamesIntegrationSnapshot(): GamesIntegrationSnapshot {
  return {
    status: "unavailable",
    message:
      "UM Games integration foundation is available as contracts only. Catalog, launch, and sessions will appear when trusted adapters are bound.",
    capabilities: listGameCapabilities(),
    permissions: defaultGamePermissions(),
    catalog: [],
  };
}
