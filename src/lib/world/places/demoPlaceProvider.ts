import type { WorldPlace, WorldPlaceProvider } from "@/src/lib/world/places/types";

export const DEMO_PLACE_PROVIDER_ID = "world-place-provider-demo" as const;

/**
 * Development-only demo cities — not production geo data.
 * Small fixed set for MapLibre Places layer foundation.
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
