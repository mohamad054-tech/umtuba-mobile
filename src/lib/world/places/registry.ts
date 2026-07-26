import { parseWorldPlace } from "@/src/lib/world/places/parsePlace";
import type { WorldPlace, WorldPlaceKind } from "@/src/lib/world/places/types";

export type PlaceRegistry = {
  clear(): void;
  register(place: WorldPlace): boolean;
  registerAll(places: WorldPlace[]): number;
  get(id: string): WorldPlace | null;
  list(): WorldPlace[];
  listByKind(kind: WorldPlaceKind): WorldPlace[];
  listCities(): WorldPlace[];
  size(): number;
};

/**
 * In-memory place index — Country / State / City / Capital.
 * Fail-closed: invalid places are rejected, never invented.
 */
export function createPlaceRegistry(
  initial: WorldPlace[] = []
): PlaceRegistry {
  const byId = new Map<string, WorldPlace>();

  const register = (place: WorldPlace): boolean => {
    const parsed = parseWorldPlace(place);
    if (!parsed) return false;
    byId.set(parsed.id, parsed);
    return true;
  };

  for (const place of initial) {
    register(place);
  }

  return {
    clear(): void {
      byId.clear();
    },
    register,
    registerAll(places: WorldPlace[]): number {
      let count = 0;
      for (const place of places) {
        if (register(place)) count += 1;
      }
      return count;
    },
    get(id: string): WorldPlace | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldPlace[] {
      return Array.from(byId.values());
    },
    listByKind(kind: WorldPlaceKind): WorldPlace[] {
      return Array.from(byId.values()).filter((p) => p.kind === kind);
    },
    listCities(): WorldPlace[] {
      return Array.from(byId.values()).filter(
        (p) => p.kind === "city" || p.kind === "capital"
      );
    },
    size(): number {
      return byId.size;
    },
  };
}
