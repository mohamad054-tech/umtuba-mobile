import {
  normalizeWorldGameRecord,
  type WorldGameRecord,
} from "@/src/lib/world/games/types";

export type GamesRegistry = {
  clear(): void;
  register(record: WorldGameRecord): boolean;
  registerAll(records: WorldGameRecord[]): number;
  get(id: string): WorldGameRecord | null;
  list(): WorldGameRecord[];
  listMappable(): WorldGameRecord[];
  size(): number;
};

export function createGamesRegistry(
  initial: WorldGameRecord[] = []
): GamesRegistry {
  const byId = new Map<string, WorldGameRecord>();

  const register = (record: WorldGameRecord): boolean => {
    const normalized = normalizeWorldGameRecord(record);
    if (!normalized) return false;
    byId.set(normalized.id, normalized);
    return true;
  };

  for (const row of initial) {
    register(row);
  }

  return {
    clear(): void {
      byId.clear();
    },
    register,
    registerAll(records: WorldGameRecord[]): number {
      if (!Array.isArray(records)) return 0;
      let accepted = 0;
      for (const row of records) {
        if (register(row)) accepted += 1;
      }
      return accepted;
    },
    get(id: string): WorldGameRecord | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldGameRecord[] {
      return Array.from(byId.values()).map((r) => ({ ...r }));
    },
    listMappable(): WorldGameRecord[] {
      return Array.from(byId.values())
        .filter(
          (r) =>
            typeof r.latitude === "number" && typeof r.longitude === "number"
        )
        .map((r) => ({ ...r }));
    },
    size(): number {
      return byId.size;
    },
  };
}
