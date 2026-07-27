import {
  formatWorldGameCategoryLabel,
  type WorldGameRecord,
} from "@/src/lib/world/games/types";

export type WorldGameSheetActionId = "open_game";

export type WorldGameSheetAction = {
  id: WorldGameSheetActionId;
  label: string;
  enabled: boolean;
  placeholder: string;
};

export type WorldGameSheetMetaId = "status" | "players";

export type WorldGameSheetMeta = {
  id: WorldGameSheetMetaId;
  label: string;
  value: string | null;
  placeholder: string;
};

export type WorldGameSheetState = {
  gameId: string;
  gameName: string;
  categoryLabel: string;
  cityName: string;
  open: boolean;
  meta: WorldGameSheetMeta[];
  actions: WorldGameSheetAction[];
};

export function buildWorldGameSheetState(
  record: WorldGameRecord | null,
  open: boolean
): WorldGameSheetState | null {
  if (!record || !open) return null;
  return {
    gameId: record.id,
    gameName: record.gameName,
    categoryLabel: formatWorldGameCategoryLabel(record.category),
    cityName: record.cityName,
    open: true,
    meta: [],
    actions: [],
  };
}
