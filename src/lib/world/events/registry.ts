import {
  normalizeWorldEventRecord,
  type WorldEventRecord,
} from "@/src/lib/world/events/types";

export type EventsRegistry = {
  clear(): void;
  register(record: WorldEventRecord): boolean;
  registerAll(records: WorldEventRecord[]): number;
  get(id: string): WorldEventRecord | null;
  list(): WorldEventRecord[];
  listMappable(): WorldEventRecord[];
  size(): number;
};

export function createEventsRegistry(
  initial: WorldEventRecord[] = []
): EventsRegistry {
  const byId = new Map<string, WorldEventRecord>();

  const register = (record: WorldEventRecord): boolean => {
    const normalized = normalizeWorldEventRecord(record);
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
    registerAll(records: WorldEventRecord[]): number {
      if (!Array.isArray(records)) return 0;
      let accepted = 0;
      for (const row of records) {
        if (register(row)) accepted += 1;
      }
      return accepted;
    },
    get(id: string): WorldEventRecord | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldEventRecord[] {
      return Array.from(byId.values()).map((r) => ({ ...r }));
    },
    listMappable(): WorldEventRecord[] {
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
