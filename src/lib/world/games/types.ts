import type {
  WorldGameCategory,
  WorldGameRecord,
} from "@/src/lib/world/dataPipeline/types";

export type { WorldGameCategory, WorldGameRecord };

export const WORLD_GAMES_LAYER_ID = "games" as const;
export const WORLD_GAMES_LAYER_REF = "world-games-layer" as const;
export const GAME_CLUSTER_MAX_ZOOM = 5.8;
export const GAME_FOCUS_ZOOM = 6.4;

export function formatWorldGameCategoryLabel(category: WorldGameCategory): string {
  switch (category) {
    case "casual_game":
      return "Casual Game";
    case "multiplayer_game":
      return "Multiplayer Game";
    case "tournament":
      return "Tournament";
    case "game_hub":
      return "Game Hub";
    default:
      return "Game";
  }
}

export function normalizeWorldGameRecord(
  raw: WorldGameRecord
): WorldGameRecord | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  const gameName =
    typeof raw.gameName === "string" && raw.gameName.trim().length > 0
      ? raw.gameName.trim()
      : typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : null;
  if (!gameName) return null;
  const category = raw.category;
  if (
    category !== "casual_game" &&
    category !== "multiplayer_game" &&
    category !== "tournament" &&
    category !== "game_hub"
  ) {
    return null;
  }
  const cityName =
    typeof raw.cityName === "string" && raw.cityName.trim().length > 0
      ? raw.cityName.trim()
      : null;
  if (!cityName) return null;
  const latitude =
    typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
      ? raw.latitude
      : null;
  const longitude =
    typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
      ? raw.longitude
      : null;
  return {
    id: raw.id.trim(),
    gameName,
    category,
    cityName,
    latitude,
    longitude,
  };
}
