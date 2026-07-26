import {
  isWorldDataKind,
  isWorldDataProviderAvailable,
  type WorldDataKind,
  type WorldDataProvider,
  type WorldCommerceDataProvider,
  type WorldEducationDataProvider,
  type WorldEventsDataProvider,
  type WorldGamesDataProvider,
  type WorldPlacesDataProvider,
  type WorldUsersDataProvider,
} from "@/src/lib/world/dataPipeline/types";

/**
 * Registers at most one provider per WorldDataKind.
 * Missing / unavailable kinds resolve to null (fail-closed).
 */
export type WorldDataRegistry = {
  register(provider: WorldDataProvider): boolean;
  get(kind: WorldDataKind): WorldDataProvider | null;
  resolve(kind: WorldDataKind): WorldDataProvider | null;
  list(): WorldDataProvider[];
  listAvailable(): WorldDataProvider[];
  has(kind: WorldDataKind): boolean;
  isAvailable(kind: WorldDataKind): boolean;
  clear(): void;
};

export function createWorldDataRegistry(
  initial: WorldDataProvider[] = []
): WorldDataRegistry {
  const byKind = new Map<WorldDataKind, WorldDataProvider>();

  const register = (provider: WorldDataProvider): boolean => {
    if (!provider || typeof provider.id !== "string" || !provider.id.trim()) {
      return false;
    }
    if (!isWorldDataKind(provider.kind)) return false;
    if (typeof provider.isAvailable !== "function") return false;
    byKind.set(provider.kind, provider);
    return true;
  };

  for (const provider of initial) {
    register(provider);
  }

  return {
    register,
    get(kind: WorldDataKind): WorldDataProvider | null {
      if (!isWorldDataKind(kind)) return null;
      return byKind.get(kind) ?? null;
    },
    resolve(kind: WorldDataKind): WorldDataProvider | null {
      const provider = byKind.get(kind) ?? null;
      return isWorldDataProviderAvailable(provider) ? provider : null;
    },
    list(): WorldDataProvider[] {
      return Array.from(byKind.values());
    },
    listAvailable(): WorldDataProvider[] {
      return Array.from(byKind.values()).filter(isWorldDataProviderAvailable);
    },
    has(kind: WorldDataKind): boolean {
      return byKind.has(kind);
    },
    isAvailable(kind: WorldDataKind): boolean {
      return isWorldDataProviderAvailable(byKind.get(kind) ?? null);
    },
    clear(): void {
      byKind.clear();
    },
  };
}

export function resolvePlacesProvider(
  registry: WorldDataRegistry
): WorldPlacesDataProvider | null {
  const provider = registry.resolve("places");
  return provider?.kind === "places" ? provider : null;
}

export function resolveUsersProvider(
  registry: WorldDataRegistry
): WorldUsersDataProvider | null {
  const provider = registry.resolve("users");
  return provider?.kind === "users" ? provider : null;
}

export function resolveEducationProvider(
  registry: WorldDataRegistry
): WorldEducationDataProvider | null {
  const provider = registry.resolve("education");
  return provider?.kind === "education" ? provider : null;
}

export function resolveGamesProvider(
  registry: WorldDataRegistry
): WorldGamesDataProvider | null {
  const provider = registry.resolve("games");
  return provider?.kind === "games" ? provider : null;
}

export function resolveCommerceProvider(
  registry: WorldDataRegistry
): WorldCommerceDataProvider | null {
  const provider = registry.resolve("commerce");
  return provider?.kind === "commerce" ? provider : null;
}

export function resolveEventsProvider(
  registry: WorldDataRegistry
): WorldEventsDataProvider | null {
  const provider = registry.resolve("events");
  return provider?.kind === "events" ? provider : null;
}
