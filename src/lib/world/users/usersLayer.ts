import type { WorldUserRecord } from "@/src/lib/world/users/types";
import {
  formatWorldUserPresenceLabel,
  userDisplayInitial,
  WORLD_USERS_LAYER_REF,
} from "@/src/lib/world/users/types";
import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";

export function createWorldUsersLayerDefinition(): WorldLayer {
  return {
    id: WORLD_USERS_LAYER_REF,
    kind: "pins",
    category: "users",
    label: "Users",
    visible: true,
    interactive: true,
    zIndex: 25,
    sourceRef: "users-provider",
  };
}

export type WorldUserMarker = {
  id: string;
  displayName: string;
  handle: string;
  cityName: string;
  initial: string;
  presenceLabel: string | null;
  latitude: number;
  longitude: number;
};

export function worldUserToMarker(
  record: WorldUserRecord
): WorldUserMarker | null {
  if (
    record.mapVisible !== true ||
    typeof record.approximateLatitude !== "number" ||
    typeof record.approximateLongitude !== "number"
  ) {
    return null;
  }
  return {
    id: record.id,
    displayName: record.displayName,
    handle: record.handle,
    cityName: record.cityName,
    initial: userDisplayInitial(record.displayName),
    presenceLabel: formatWorldUserPresenceLabel(record.presence),
    latitude: record.approximateLatitude,
    longitude: record.approximateLongitude,
  };
}

export function worldUsersToMarkers(
  records: WorldUserRecord[]
): WorldUserMarker[] {
  const out: WorldUserMarker[] = [];
  for (const row of records) {
    const marker = worldUserToMarker(row);
    if (marker) out.push(marker);
  }
  return out;
}

export function worldUserToEntity(
  record: WorldUserRecord
): WorldEntity | null {
  if (
    record.mapVisible !== true ||
    typeof record.approximateLatitude !== "number" ||
    typeof record.approximateLongitude !== "number"
  ) {
    return null;
  }
  const presence = formatWorldUserPresenceLabel(record.presence);
  return {
    id: record.id,
    kind: "user",
    category: "users",
    title: record.displayName,
    subtitle: presence
      ? `@${record.handle} · ${record.cityName} · ${presence}`
      : `@${record.handle} · ${record.cityName}`,
    latitude: record.approximateLatitude,
    longitude: record.approximateLongitude,
    destination: null,
  };
}

export function worldUsersToEntities(
  records: WorldUserRecord[]
): WorldEntity[] {
  const out: WorldEntity[] = [];
  for (const row of records) {
    const entity = worldUserToEntity(row);
    if (entity) out.push(entity);
  }
  return out;
}

export function usersMarkersToGeoJSON(
  markers: WorldUserMarker[],
  selectedId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      id: m.id,
      properties: {
        id: m.id,
        displayName: m.displayName,
        handle: m.handle,
        cityName: m.cityName,
        initial: m.initial,
        presenceLabel: m.presenceLabel ?? "",
        selected: selectedId === m.id ? 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [m.longitude, m.latitude],
      },
    })),
  };
}

/** Pure helper: clustering considered active when zoom is at/below max. */
export function isUserClusteringActiveAtZoom(zoom: number): boolean {
  return typeof zoom === "number" && zoom <= 5.5;
}
