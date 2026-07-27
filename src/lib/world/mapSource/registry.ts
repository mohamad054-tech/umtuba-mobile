import { createDemoMapSource, DEMO_MAP_SOURCE_ID } from "@/src/lib/world/mapSource/demoMapSource";
import { createSatelliteMapSource } from "@/src/lib/world/mapSource/satelliteMapSource";
import { createStreetMapSource } from "@/src/lib/world/mapSource/streetMapSource";
import { createTerrainMapSource } from "@/src/lib/world/mapSource/terrainMapSource";
import {
  isWorldMapSourceAvailable,
  type WorldMapSource,
} from "@/src/lib/world/mapSource/types";

export type MapSourceRegistry = {
  register(source: WorldMapSource): void;
  get(id: string): WorldMapSource | null;
  list(): WorldMapSource[];
  listAvailable(): WorldMapSource[];
  /**
   * Select a usable map source.
   * Prefer `preferredId` when available; otherwise first available; else null (fail-closed).
   */
  resolve(preferredId?: string | null): WorldMapSource | null;
};

export function createMapSourceRegistry(
  initial: WorldMapSource[] = []
): MapSourceRegistry {
  const byId = new Map<string, WorldMapSource>();

  const register = (source: WorldMapSource): void => {
    if (!source?.id || typeof source.id !== "string") return;
    byId.set(source.id, source);
  };

  for (const source of initial) {
    register(source);
  }

  return {
    register,
    get(id: string): WorldMapSource | null {
      if (!id || typeof id !== "string") return null;
      return byId.get(id) ?? null;
    },
    list(): WorldMapSource[] {
      return Array.from(byId.values());
    },
    listAvailable(): WorldMapSource[] {
      return Array.from(byId.values()).filter(isWorldMapSourceAvailable);
    },
    resolve(preferredId?: string | null): WorldMapSource | null {
      if (typeof preferredId === "string" && preferredId.trim().length > 0) {
        const preferred = byId.get(preferredId.trim()) ?? null;
        if (isWorldMapSourceAvailable(preferred)) return preferred;
      }
      const available = Array.from(byId.values()).filter(
        isWorldMapSourceAvailable
      );
      return available[0] ?? null;
    },
  };
}

/**
 * Default registry: Streets first (product default), then Satellite/Terrain.
 * Demo remains registered for fail-closed fallback only — not shown in product UI.
 */
export function createDefaultMapSourceRegistry(): MapSourceRegistry {
  return createMapSourceRegistry([
    createStreetMapSource(),
    createSatelliteMapSource(),
    createTerrainMapSource(),
    createDemoMapSource(),
  ]);
}

export { DEMO_MAP_SOURCE_ID };
