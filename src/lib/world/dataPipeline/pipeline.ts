import {
  createWorldDataRegistry,
  resolveCommerceProvider,
  resolveEducationProvider,
  resolveEventsProvider,
  resolveGamesProvider,
  resolvePlacesProvider,
  resolveUsersProvider,
  type WorldDataRegistry,
} from "@/src/lib/world/dataPipeline/registry";
import {
  adaptPlaceProvider,
  createDemoCommerceDataProvider,
  createDemoEducationDataProvider,
  createDemoEventsDataProvider,
  createDemoGamesDataProvider,
  createDemoPlacesDataProvider,
  createDemoUsersDataProvider,
  createUnboundCommerceDataProvider,
  createUnboundEducationDataProvider,
  createUnboundEventsDataProvider,
  createUnboundGamesDataProvider,
  createUnboundPlacesDataProvider,
  createUnboundUsersDataProvider,
} from "@/src/lib/world/dataPipeline/providers";
import {
  emptyWorldDataBundle,
  type WorldCommerceRecord,
  type WorldDataBundle,
  type WorldDataKind,
  type WorldDataProvider,
  type WorldEducationRecord,
  type WorldEventRecord,
  type WorldGameRecord,
  type WorldUserRecord,
} from "@/src/lib/world/dataPipeline/types";
import type { WorldPlace, WorldPlaceProvider } from "@/src/lib/world/places/types";

/**
 * Sole Runtime entry for World domain data.
 * Renderer / UI must never call providers or the registry directly.
 */
export type WorldDataPipeline = {
  getRegistry(): WorldDataRegistry;
  isKindAvailable(kind: WorldDataKind): boolean;
  hasProvider(kind: WorldDataKind): boolean;
  loadPlaces(): Promise<WorldPlace[]>;
  loadUsers(): Promise<WorldUserRecord[]>;
  loadEducation(): Promise<WorldEducationRecord[]>;
  loadGames(): Promise<WorldGameRecord[]>;
  loadCommerce(): Promise<WorldCommerceRecord[]>;
  loadEvents(): Promise<WorldEventRecord[]>;
  /** Load all kinds independently — missing/unavailable kinds yield []. */
  loadAll(): Promise<WorldDataBundle>;
};

export type CreateWorldDataPipelineOptions = {
  registry?: WorldDataRegistry;
  providers?: WorldDataProvider[];
  /**
   * Override / inject Places foundation provider (adapted into pipeline).
   * Pass `null` for unbound places while keeping other demo kinds.
   */
  placeProvider?: WorldPlaceProvider | null;
};

async function safeList<T>(run: () => Promise<T[]>): Promise<T[]> {
  try {
    const rows = await run();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function createWorldDataPipeline(
  options?: CreateWorldDataPipelineOptions
): WorldDataPipeline {
  const registry =
    options?.registry ?? createWorldDataRegistry(options?.providers ?? []);

  if (options?.placeProvider === null) {
    registry.register(createUnboundPlacesDataProvider());
  } else if (options?.placeProvider) {
    registry.register(adaptPlaceProvider(options.placeProvider));
  }

  const loadPlaces = async (): Promise<WorldPlace[]> => {
    const provider = resolvePlacesProvider(registry);
    if (!provider) return [];
    return safeList(() => provider.listPlaces());
  };
  const loadUsers = async (): Promise<WorldUserRecord[]> => {
    const provider = resolveUsersProvider(registry);
    if (!provider) return [];
    return safeList(() => provider.listUsers());
  };
  const loadEducation = async (): Promise<WorldEducationRecord[]> => {
    const provider = resolveEducationProvider(registry);
    if (!provider) return [];
    return safeList(() => provider.listEducation());
  };
  const loadGames = async (): Promise<WorldGameRecord[]> => {
    const provider = resolveGamesProvider(registry);
    if (!provider) return [];
    return safeList(() => provider.listGames());
  };
  const loadCommerce = async (): Promise<WorldCommerceRecord[]> => {
    const provider = resolveCommerceProvider(registry);
    if (!provider) return [];
    return safeList(() => provider.listCommerce());
  };
  const loadEvents = async (): Promise<WorldEventRecord[]> => {
    const provider = resolveEventsProvider(registry);
    if (!provider) return [];
    return safeList(() => provider.listEvents());
  };

  return {
    getRegistry(): WorldDataRegistry {
      return registry;
    },
    isKindAvailable(kind: WorldDataKind): boolean {
      return registry.isAvailable(kind);
    },
    hasProvider(kind: WorldDataKind): boolean {
      return registry.has(kind);
    },
    loadPlaces,
    loadUsers,
    loadEducation,
    loadGames,
    loadCommerce,
    loadEvents,
    async loadAll(): Promise<WorldDataBundle> {
      const [places, users, education, games, commerce, events] =
        await Promise.all([
          loadPlaces(),
          loadUsers(),
          loadEducation(),
          loadGames(),
          loadCommerce(),
          loadEvents(),
        ]);
      return { places, users, education, games, commerce, events };
    },
  };
}

/** Default demo pipeline: Places (demo cities) + empty Users/Education/Games/Commerce/Events. */
export function createDefaultWorldDataPipeline(
  options?: Pick<CreateWorldDataPipelineOptions, "placeProvider">
): WorldDataPipeline {
  const places =
    options?.placeProvider === null
      ? createUnboundPlacesDataProvider()
      : options?.placeProvider
        ? adaptPlaceProvider(options.placeProvider)
        : createDemoPlacesDataProvider();

  return createWorldDataPipeline({
    providers: [
      places,
      createDemoUsersDataProvider(),
      createDemoEducationDataProvider(),
      createDemoGamesDataProvider(),
      createDemoCommerceDataProvider(),
      createDemoEventsDataProvider(),
    ],
  });
}

/** All kinds unbound / empty — fail-closed baseline. */
export function createEmptyWorldDataPipeline(): WorldDataPipeline {
  return createWorldDataPipeline({
    providers: [
      createUnboundPlacesDataProvider(),
      createUnboundUsersDataProvider(),
      createUnboundEducationDataProvider(),
      createUnboundGamesDataProvider(),
      createUnboundCommerceDataProvider(),
      createUnboundEventsDataProvider(),
    ],
  });
}

export { emptyWorldDataBundle };
