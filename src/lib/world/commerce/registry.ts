import {
  normalizeWorldCommerceRecord,
  type WorldCommerceRecord,
} from "@/src/lib/world/commerce/types";

export type CommerceRegistry = {
  clear(): void;
  register(record: WorldCommerceRecord): boolean;
  registerAll(records: WorldCommerceRecord[]): number;
  get(id: string): WorldCommerceRecord | null;
  list(): WorldCommerceRecord[];
  listMappable(): WorldCommerceRecord[];
  size(): number;
};

export function createCommerceRegistry(
  initial: WorldCommerceRecord[] = []
): CommerceRegistry {
  const byId = new Map<string, WorldCommerceRecord>();

  const register = (record: WorldCommerceRecord): boolean => {
    const normalized = normalizeWorldCommerceRecord(record);
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
    registerAll(records: WorldCommerceRecord[]): number {
      if (!Array.isArray(records)) return 0;
      let accepted = 0;
      for (const row of records) {
        if (register(row)) accepted += 1;
      }
      return accepted;
    },
    get(id: string): WorldCommerceRecord | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldCommerceRecord[] {
      return Array.from(byId.values()).map((r) => ({ ...r }));
    },
    listMappable(): WorldCommerceRecord[] {
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
