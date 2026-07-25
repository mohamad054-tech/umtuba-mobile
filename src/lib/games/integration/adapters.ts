/**
 * Adapter interfaces only — no launcher, engine, or network implementation.
 */

import type {
  GameCatalogEntry,
  GameEntity,
  GameLaunchContract,
  GamesIntegrationSnapshot,
} from "@/src/lib/games/integration/types";

export type GameCatalogAdapter = {
  readonly id: string;
  parseCatalogEntry(raw: unknown): GameCatalogEntry | null;
};

export type GameLaunchAdapter = {
  readonly id: string;
  resolveLaunch(raw: unknown): GameLaunchContract | null;
};

export type GameEntityAdapter = {
  readonly id: string;
  parseGame(raw: unknown): GameEntity | null;
};

export type GamesIntegrationAdapter = {
  readonly id: string;
  getSnapshot(): GamesIntegrationSnapshot;
};

export function isGamesIntegrationAdapterBound(): boolean {
  return false;
}

/** Launcher execution is never available in foundation. */
export function isGameLauncherBound(): boolean {
  return false;
}
