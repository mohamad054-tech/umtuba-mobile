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

const PLACEHOLDER_META: WorldGameSheetMeta[] = [
  { id: "status", label: "Status", value: null, placeholder: "Coming soon" },
  { id: "players", label: "Players", value: null, placeholder: "Coming soon" },
];

const PLACEHOLDER_ACTIONS: WorldGameSheetAction[] = [
  {
    id: "open_game",
    label: "Open Game",
    enabled: false,
    placeholder: "Coming soon",
  },
];

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
    meta: PLACEHOLDER_META.map((m) => ({ ...m })),
    actions: PLACEHOLDER_ACTIONS.map((a) => ({ ...a })),
  };
}
