import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";
import type { WorldEventRecord } from "@/src/lib/world/events/types";
import {
  EVENT_CLUSTER_MAX_ZOOM,
  formatWorldEventKindLabel,
  WORLD_EVENTS_LAYER_REF,
} from "@/src/lib/world/events/types";

export function createWorldEventsLayerDefinition(): WorldLayer {
  return {
    id: WORLD_EVENTS_LAYER_REF,
    kind: "pins",
    category: "events",
    label: "Events",
    visible: true,
    interactive: true,
    zIndex: 28,
    sourceRef: "events-provider",
  };
}

export type WorldEventMarker = {
  id: string;
  eventName: string;
  eventType: WorldEventRecord["eventType"];
  eventTypeLabel: string;
  cityName: string;
  latitude: number;
  longitude: number;
};

export function worldEventToMarker(
  record: WorldEventRecord
): WorldEventMarker | null {
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
    return null;
  }
  return {
    id: record.id,
    eventName: record.eventName,
    eventType: record.eventType,
    eventTypeLabel: formatWorldEventKindLabel(record.eventType),
    cityName: record.cityName,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

export function worldEventsToMarkers(
  records: WorldEventRecord[]
): WorldEventMarker[] {
  const out: WorldEventMarker[] = [];
  for (const row of records) {
    const marker = worldEventToMarker(row);
    if (marker) out.push(marker);
  }
  return out;
}

export function worldEventToEntity(record: WorldEventRecord): WorldEntity | null {
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
    return null;
  }
  return {
    id: record.id,
    kind: "event",
    category: "events",
    title: record.eventName,
    subtitle: `${formatWorldEventKindLabel(record.eventType)} · ${record.cityName}`,
    latitude: record.latitude,
    longitude: record.longitude,
    destination: null,
  };
}

export function worldEventsToEntities(records: WorldEventRecord[]): WorldEntity[] {
  const out: WorldEntity[] = [];
  for (const row of records) {
    const entity = worldEventToEntity(row);
    if (entity) out.push(entity);
  }
  return out;
}

export function eventsMarkersToGeoJSON(
  markers: WorldEventMarker[],
  selectedId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      id: m.id,
      properties: {
        id: m.id,
        eventName: m.eventName,
        eventType: m.eventType,
        eventTypeLabel: m.eventTypeLabel,
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

export function isEventClusteringActiveAtZoom(zoom: number): boolean {
  return typeof zoom === "number" && zoom <= EVENT_CLUSTER_MAX_ZOOM;
}
