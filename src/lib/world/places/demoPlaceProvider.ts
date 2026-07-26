import type { WorldPlace, WorldPlaceProvider } from "@/src/lib/world/places/types";

export const DEMO_PLACE_PROVIDER_ID = "world-place-provider-demo" as const;

/**
 * Development-only demo cities — not production geo data.
 * Includes Capitals / Major / Minor tiers for Places UX layers.
 */
const DEMO_PLACES: WorldPlace[] = [
  {
    id: "place-jerusalem",
    kind: "capital",
    name: "Jerusalem",
    countryName: "Palestine",
    countryCode: "PS",
    stateName: null,
    latitude: 31.7683,
    longitude: 35.2137,
    cityTier: "capital",
  },
  {
    id: "place-amman",
    kind: "capital",
    name: "Amman",
    countryName: "Jordan",
    countryCode: "JO",
    stateName: null,
    latitude: 31.9539,
    longitude: 35.9106,
    cityTier: "capital",
  },
  {
    id: "place-dubai",
    kind: "city",
    name: "Dubai",
    countryName: "United Arab Emirates",
    countryCode: "AE",
    stateName: "Dubai",
    latitude: 25.2048,
    longitude: 55.2708,
    cityTier: "major",
  },
  {
    id: "place-riyadh",
    kind: "capital",
    name: "Riyadh",
    countryName: "Saudi Arabia",
    countryCode: "SA",
    stateName: null,
    latitude: 24.7136,
    longitude: 46.6753,
    cityTier: "capital",
  },
  {
    id: "place-cairo",
    kind: "capital",
    name: "Cairo",
    countryName: "Egypt",
    countryCode: "EG",
    stateName: null,
    latitude: 30.0444,
    longitude: 31.2357,
    cityTier: "capital",
  },
  {
    id: "place-london",
    kind: "capital",
    name: "London",
    countryName: "United Kingdom",
    countryCode: "GB",
    stateName: "England",
    latitude: 51.5074,
    longitude: -0.1278,
    cityTier: "capital",
  },
  {
    id: "place-tokyo",
    kind: "capital",
    name: "Tokyo",
    countryName: "Japan",
    countryCode: "JP",
    stateName: null,
    latitude: 35.6762,
    longitude: 139.6503,
    cityTier: "capital",
  },
  {
    id: "place-new-york",
    kind: "city",
    name: "New York",
    countryName: "United States",
    countryCode: "US",
    stateName: "New York",
    latitude: 40.7128,
    longitude: -74.006,
    cityTier: "major",
  },
  {
    id: "place-aqaba",
    kind: "city",
    name: "Aqaba",
    countryName: "Jordan",
    countryCode: "JO",
    stateName: null,
    latitude: 29.5319,
    longitude: 35.0063,
    cityTier: "minor",
  },
  {
    id: "place-irbid",
    kind: "city",
    name: "Irbid",
    countryName: "Jordan",
    countryCode: "JO",
    stateName: null,
    latitude: 32.5556,
    longitude: 35.85,
    cityTier: "minor",
  },
  {
    id: "place-alexandria",
    kind: "city",
    name: "Alexandria",
    countryName: "Egypt",
    countryCode: "EG",
    stateName: null,
    latitude: 31.2001,
    longitude: 29.9187,
    cityTier: "minor",
  },
];

export function listDemoPlaces(): WorldPlace[] {
  return DEMO_PLACES.map((p) => ({ ...p }));
}

export function createDemoPlaceProvider(): WorldPlaceProvider {
  return {
    id: DEMO_PLACE_PROVIDER_ID,
    isAvailable(): boolean {
      return true;
    },
    async listPlaces(): Promise<WorldPlace[]> {
      return listDemoPlaces();
    },
  };
}

/** Fail-closed unbound provider — no places, no invented data. */
export function createUnboundPlaceProvider(): WorldPlaceProvider {
  return {
    id: "world-place-provider-none",
    isAvailable(): boolean {
      return false;
    },
    async listPlaces(): Promise<WorldPlace[]> {
      return [];
    },
  };
}
