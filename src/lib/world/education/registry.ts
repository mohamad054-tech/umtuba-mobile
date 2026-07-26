import {
  normalizeWorldEducationRecord,
  type WorldEducationRecord,
} from "@/src/lib/world/education/types";

export type EducationRegistry = {
  clear(): void;
  register(record: WorldEducationRecord): boolean;
  registerAll(records: WorldEducationRecord[]): number;
  get(id: string): WorldEducationRecord | null;
  list(): WorldEducationRecord[];
  /** Records with trusted coordinates for map markers. */
  listMappable(): WorldEducationRecord[];
  size(): number;
};

export function createEducationRegistry(
  initial: WorldEducationRecord[] = []
): EducationRegistry {
  const byId = new Map<string, WorldEducationRecord>();

  const register = (record: WorldEducationRecord): boolean => {
    const normalized = normalizeWorldEducationRecord(record);
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
    registerAll(records: WorldEducationRecord[]): number {
      if (!Array.isArray(records)) return 0;
      let accepted = 0;
      for (const row of records) {
        if (register(row)) accepted += 1;
      }
      return accepted;
    },
    get(id: string): WorldEducationRecord | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldEducationRecord[] {
      return Array.from(byId.values()).map((r) => ({ ...r }));
    },
    listMappable(): WorldEducationRecord[] {
      return Array.from(byId.values())
        .filter(
          (r) =>
            typeof r.latitude === "number" &&
            typeof r.longitude === "number"
        )
        .map((r) => ({ ...r }));
    },
    size(): number {
      return byId.size;
    },
  };
}
