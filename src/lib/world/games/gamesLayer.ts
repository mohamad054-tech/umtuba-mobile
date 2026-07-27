import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";
import type { WorldGameRecord } from "@/src/lib/world/games/types";
import {
  formatWorldGameCategoryLabel,
  GAME_CLUSTER_MAX_ZOOM,
  WORLD_GAMES_LAYER_REF,
} from "@/src/lib/world/games/types";

export function createWorldGamesLayerDefinition(): WorldLayer {
  return {
    id: WORLD_GAMES_LAYER_REF,
    kind: "pins",
    category: "games",
    label: "Games",
    visible: true,
    interactive: true,
    zIndex: 26,
    sourceRef: "games-provider",
  };
}

export type WorldGameMarker = {
  id: string;
  gameName: string;
  category: WorldGameRecord["category"];
  categoryLabel: string;
  cityName: string;
  latitude: number;
  longitude: number;
};

export function worldGameToMarker(record: WorldGameRecord): WorldGameMarker | null {
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
    return null;
  }
  return {
    id: record.id,
    gameName: record.gameName,
    category: record.category,
    categoryLabel: formatWorldGameCategoryLabel(record.category),
    cityName: record.cityName,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

export function worldGamesToMarkers(records: WorldGameRecord[]): WorldGameMarker[] {
  const out: WorldGameMarker[] = [];
  for (const row of records) {
    const marker = worldGameToMarker(row);
    if (marker) out.push(marker);
  }
  return out;
}

export function worldGameToEntity(record: WorldGameRecord): WorldEntity | null {
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
    return null;
  }
  return {
    id: record.id,
    kind: "game",
    category: "games",
    title: record.gameName,
    subtitle: `${formatWorldGameCategoryLabel(record.category)} · ${record.cityName}`,
    latitude: record.latitude,
    longitude: record.longitude,
    destination: null,
  };
}

export function worldGamesToEntities(records: WorldGameRecord[]): WorldEntity[] {
  const out: WorldEntity[] = [];
  for (const row of records) {
    const entity = worldGameToEntity(row);
    if (entity) out.push(entity);
  }
  return out;
}

export function gamesMarkersToGeoJSON(
  markers: WorldGameMarker[],
  selectedId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      id: m.id,
      properties: {
        id: m.id,
        gameName: m.gameName,
        category: m.category,
        categoryLabel: m.categoryLabel,
        cityName: m.cityName,
        selected: selectedId === m.id ? 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [m.longitude, m.latitude],
      },
    })),
  };
}

export function isGameClusteringActiveAtZoom(zoom: number): boolean {
  return typeof zoom === "number" && zoom <= GAME_CLUSTER_MAX_ZOOM;
}
