import type { WorldPlace, WorldPlaceProvider } from "@/src/lib/world/places/types";
import {
  createDemoPlaceProvider,
  createUnboundPlaceProvider,
} from "@/src/lib/world/places/demoPlaceProvider";
import type {
  WorldCommerceDataProvider,
  WorldCommerceRecord,
  WorldEducationDataProvider,
  WorldEducationRecord,
  WorldEventsDataProvider,
  WorldEventRecord,
  WorldGamesDataProvider,
  WorldGameRecord,
  WorldPlacesDataProvider,
  WorldUsersDataProvider,
  WorldUserRecord,
} from "@/src/lib/world/dataPipeline/types";

export const DEMO_PLACES_DATA_PROVIDER_ID =
  "world-data-provider-places-demo" as const;
export const DEMO_USERS_DATA_PROVIDER_ID =
  "world-data-provider-users-demo" as const;
export const DEMO_EDUCATION_DATA_PROVIDER_ID =
  "world-data-provider-education-demo" as const;
export const DEMO_GAMES_DATA_PROVIDER_ID =
  "world-data-provider-games-demo" as const;
export const DEMO_COMMERCE_DATA_PROVIDER_ID =
  "world-data-provider-commerce-demo" as const;
export const DEMO_EVENTS_DATA_PROVIDER_ID =
  "world-data-provider-events-demo" as const;

/** Adapt Places foundation provider into the unified data-pipeline contract. */
export function adaptPlaceProvider(
  placeProvider: WorldPlaceProvider
): WorldPlacesDataProvider {
  return {
    id: placeProvider.id,
    kind: "places",
    isAvailable: () => placeProvider.isAvailable(),
    listPlaces: () => placeProvider.listPlaces(),
  };
}

export function createDemoPlacesDataProvider(): WorldPlacesDataProvider {
  return {
    ...adaptPlaceProvider(createDemoPlaceProvider()),
    id: DEMO_PLACES_DATA_PROVIDER_ID,
  };
}

export function createUnboundPlacesDataProvider(): WorldPlacesDataProvider {
  return {
    ...adaptPlaceProvider(createUnboundPlaceProvider()),
    id: "world-data-provider-places-none",
  };
}

export function createDemoUsersDataProvider(): WorldUsersDataProvider {
  return {
    id: DEMO_USERS_DATA_PROVIDER_ID,
    kind: "users",
    isAvailable: () => true,
    async listUsers(): Promise<WorldUserRecord[]> {
      return [];
    },
  };
}

export function createUnboundUsersDataProvider(): WorldUsersDataProvider {
  return {
    id: "world-data-provider-users-none",
    kind: "users",
    isAvailable: () => false,
    async listUsers(): Promise<WorldUserRecord[]> {
      return [];
    },
  };
}

export function createDemoEducationDataProvider(): WorldEducationDataProvider {
  return {
    id: DEMO_EDUCATION_DATA_PROVIDER_ID,
    kind: "education",
    isAvailable: () => true,
    async listEducation(): Promise<WorldEducationRecord[]> {
      return [];
    },
  };
}

export function createUnboundEducationDataProvider(): WorldEducationDataProvider {
  return {
    id: "world-data-provider-education-none",
    kind: "education",
    isAvailable: () => false,
    async listEducation(): Promise<WorldEducationRecord[]> {
      return [];
    },
  };
}

export function createDemoGamesDataProvider(): WorldGamesDataProvider {
  return {
    id: DEMO_GAMES_DATA_PROVIDER_ID,
    kind: "games",
    isAvailable: () => true,
    async listGames(): Promise<WorldGameRecord[]> {
      return [];
    },
  };
}

export function createUnboundGamesDataProvider(): WorldGamesDataProvider {
  return {
    id: "world-data-provider-games-none",
    kind: "games",
    isAvailable: () => false,
    async listGames(): Promise<WorldGameRecord[]> {
      return [];
    },
  };
}

export function createDemoCommerceDataProvider(): WorldCommerceDataProvider {
  return {
    id: DEMO_COMMERCE_DATA_PROVIDER_ID,
    kind: "commerce",
    isAvailable: () => true,
    async listCommerce(): Promise<WorldCommerceRecord[]> {
      return [];
    },
  };
}

export function createUnboundCommerceDataProvider(): WorldCommerceDataProvider {
  return {
    id: "world-data-provider-commerce-none",
    kind: "commerce",
    isAvailable: () => false,
    async listCommerce(): Promise<WorldCommerceRecord[]> {
      return [];
    },
  };
}

export function createDemoEventsDataProvider(): WorldEventsDataProvider {
  return {
    id: DEMO_EVENTS_DATA_PROVIDER_ID,
    kind: "events",
    isAvailable: () => true,
    async listEvents(): Promise<WorldEventRecord[]> {
      return [];
    },
  };
}

export function createUnboundEventsDataProvider(): WorldEventsDataProvider {
  return {
    id: "world-data-provider-events-none",
    kind: "events",
    isAvailable: () => false,
    async listEvents(): Promise<WorldEventRecord[]> {
      return [];
    },
  };
}

/** Re-export helper for tests that need a place list via the adapted demo. */
export async function listDemoPlacesViaPipeline(): Promise<WorldPlace[]> {
  return createDemoPlacesDataProvider().listPlaces();
}
