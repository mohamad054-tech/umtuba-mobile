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

/** Development-only education pins — not production campus data. */
const DEMO_EDUCATION_RECORDS: WorldEducationRecord[] = [
  {
    id: "edu-university-jordan",
    name: "University of Jordan",
    educationType: "university",
    cityName: "Amman",
    latitude: 32.0153,
    longitude: 35.8685,
  },
  {
    id: "edu-cairo-university",
    name: "Cairo University",
    educationType: "university",
    cityName: "Cairo",
    latitude: 30.0274,
    longitude: 31.2089,
  },
  {
    id: "edu-ksu-riyadh",
    name: "King Saud University",
    educationType: "university",
    cityName: "Riyadh",
    latitude: 24.7236,
    longitude: 46.6245,
  },
  {
    id: "edu-amman-intl-school",
    name: "Amman International School",
    educationType: "school",
    cityName: "Amman",
    latitude: 31.962,
    longitude: 35.877,
  },
  {
    id: "edu-dubai-learning-hub",
    name: "Dubai Learning Hub",
    educationType: "learning_center",
    cityName: "Dubai",
    latitude: 25.1972,
    longitude: 55.2744,
  },
  {
    id: "edu-british-council-amman",
    name: "British Council Amman",
    educationType: "learning_center",
    cityName: "Amman",
    latitude: 31.953,
    longitude: 35.91,
  },
];

/**
 * Development-only public demo users.
 * Coordinates are city-level approximate pins — not precise locations.
 * No email / phone / real identity data. Hidden user tests privacy filter.
 */
const DEMO_USER_RECORDS: WorldUserRecord[] = [
  {
    id: "user-demo-layla",
    displayName: "Layla",
    handle: "layla",
    cityName: "Amman",
    approximateLatitude: 31.96,
    approximateLongitude: 35.92,
    mapVisible: true,
    presence: "online",
  },
  {
    id: "user-demo-omar",
    displayName: "Omar",
    handle: "omar_h",
    cityName: "Amman",
    approximateLatitude: 31.94,
    approximateLongitude: 35.89,
    mapVisible: true,
    presence: "active_recently",
  },
  {
    id: "user-demo-sara",
    displayName: "Sara",
    handle: "sara.k",
    cityName: "Cairo",
    approximateLatitude: 30.05,
    approximateLongitude: 31.24,
    mapVisible: true,
    presence: "online",
  },
  {
    id: "user-demo-noura",
    displayName: "Noura",
    handle: "noura",
    cityName: "Dubai",
    approximateLatitude: 25.21,
    approximateLongitude: 55.28,
    mapVisible: true,
    presence: null,
  },
  {
    id: "user-demo-yousef",
    displayName: "Yousef",
    handle: "yousef",
    cityName: "Riyadh",
    approximateLatitude: 24.72,
    approximateLongitude: 46.68,
    mapVisible: true,
    presence: "active_recently",
  },
  {
    id: "user-demo-hidden",
    displayName: "Hidden",
    handle: "hidden_user",
    cityName: "Amman",
    approximateLatitude: 31.95,
    approximateLongitude: 35.91,
    mapVisible: false,
    presence: "online",
  },
];

/** Development-only demo games layer records. */
const DEMO_GAME_RECORDS: WorldGameRecord[] = [
  {
    id: "game-casual-amman",
    gameName: "Night Runner",
    category: "casual_game",
    cityName: "Amman",
    latitude: 31.956,
    longitude: 35.93,
  },
  {
    id: "game-multi-cairo",
    gameName: "Squad Arena",
    category: "multiplayer_game",
    cityName: "Cairo",
    latitude: 30.041,
    longitude: 31.232,
  },
  {
    id: "game-tourney-riyadh",
    gameName: "Riyadh Open Cup",
    category: "tournament",
    cityName: "Riyadh",
    latitude: 24.716,
    longitude: 46.675,
  },
  {
    id: "game-hub-dubai",
    gameName: "DXB Game Hub",
    category: "game_hub",
    cityName: "Dubai",
    latitude: 25.206,
    longitude: 55.273,
  },
];

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
      return DEMO_USER_RECORDS.map((row) => ({ ...row }));
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
      return DEMO_EDUCATION_RECORDS.map((row) => ({ ...row }));
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

/** Development-only demo commerce layer records — approximate public coords only. */
const DEMO_COMMERCE_RECORDS: WorldCommerceRecord[] = [
  {
    id: "commerce-store-amman",
    name: "Rainbow Market Store",
    commerceType: "store",
    cityName: "Amman",
    brandName: "Rainbow Market",
    latitude: 31.955,
    longitude: 35.928,
    mapVisible: true,
    published: true,
  },
  {
    id: "commerce-restaurant-cairo",
    name: "Nile Corner Restaurant",
    commerceType: "restaurant",
    cityName: "Cairo",
    brandName: "Nile Corner",
    latitude: 30.044,
    longitude: 31.235,
    mapVisible: true,
    published: true,
  },
  {
    id: "commerce-market-riyadh",
    name: "Souq Al-Thumairi",
    commerceType: "market",
    cityName: "Riyadh",
    brandName: null,
    latitude: 24.713,
    longitude: 46.675,
    mapVisible: true,
    published: true,
  },
  {
    id: "commerce-service-dubai",
    name: "Marina Tech Service",
    commerceType: "service",
    cityName: "Dubai",
    brandName: "Marina Tech",
    latitude: 25.198,
    longitude: 55.279,
    mapVisible: true,
    published: true,
  },
  {
    id: "commerce-seller-hub-amman",
    name: "Amman Seller Hub",
    commerceType: "seller_hub",
    cityName: "Amman",
    brandName: "UM Sellers",
    latitude: 31.948,
    longitude: 35.905,
    mapVisible: true,
    published: true,
  },
  {
    id: "commerce-hidden-draft",
    name: "Draft Commerce Node",
    commerceType: "store",
    cityName: "Amman",
    brandName: null,
    latitude: 31.95,
    longitude: 35.91,
    mapVisible: false,
    published: false,
  },
];

export function createDemoGamesDataProvider(): WorldGamesDataProvider {
  return {
    id: DEMO_GAMES_DATA_PROVIDER_ID,
    kind: "games",
    isAvailable: () => true,
    async listGames(): Promise<WorldGameRecord[]> {
      return DEMO_GAME_RECORDS.map((row) => ({ ...row }));
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
      return DEMO_COMMERCE_RECORDS.map((row) => ({ ...row }));
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
