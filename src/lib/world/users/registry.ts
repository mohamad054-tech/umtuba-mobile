import {
  normalizeWorldUserRecord,
  type WorldUserRecord,
} from "@/src/lib/world/users/types";

export type UsersRegistry = {
  clear(): void;
  register(record: WorldUserRecord): boolean;
  registerAll(records: WorldUserRecord[]): number;
  get(id: string): WorldUserRecord | null;
  list(): WorldUserRecord[];
  /** Visible users with approximate coordinates for map markers. */
  listMappable(): WorldUserRecord[];
  size(): number;
};

export function createUsersRegistry(
  initial: WorldUserRecord[] = []
): UsersRegistry {
  const byId = new Map<string, WorldUserRecord>();

  const register = (record: WorldUserRecord): boolean => {
    const normalized = normalizeWorldUserRecord(record);
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
    registerAll(records: WorldUserRecord[]): number {
      if (!Array.isArray(records)) return 0;
      let accepted = 0;
      for (const row of records) {
        if (register(row)) accepted += 1;
      }
      return accepted;
    },
    get(id: string): WorldUserRecord | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldUserRecord[] {
      return Array.from(byId.values()).map((r) => ({ ...r }));
    },
    listMappable(): WorldUserRecord[] {
      return Array.from(byId.values())
        .filter(
          (r) =>
            r.mapVisible === true &&
            typeof r.approximateLatitude === "number" &&
            typeof r.approximateLongitude === "number"
        )
        .map((r) => ({ ...r }));
    },
    size(): number {
      return byId.size;
    },
  };
}
