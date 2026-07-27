import type {
  WorldEventKind,
  WorldEventRecord,
} from "@/src/lib/world/dataPipeline/types";

export type { WorldEventKind, WorldEventRecord };

export const WORLD_EVENTS_LAYER_ID = "events" as const;
export const WORLD_EVENTS_LAYER_REF = "world-events-layer" as const;
export const EVENT_CLUSTER_MAX_ZOOM = 5.6;
export const EVENT_FOCUS_ZOOM = 6.2;

const EVENT_KINDS = new Set<WorldEventKind>([
  "conference",
  "workshop",
  "meetup",
  "festival",
  "tournament",
  "live_event",
]);

export function formatWorldEventKindLabel(eventType: WorldEventKind): string {
  switch (eventType) {
    case "conference":
      return "Conference";
    case "workshop":
      return "Workshop";
    case "meetup":
      return "Meetup";
    case "festival":
      return "Festival";
    case "tournament":
      return "Tournament";
    case "live_event":
      return "Live Event";
    default:
      return "Event";
  }
}

export function normalizeWorldEventRecord(
  raw: WorldEventRecord
): WorldEventRecord | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;

  const eventName =
    typeof raw.eventName === "string" && raw.eventName.trim().length > 0
      ? raw.eventName.trim()
      : typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : null;
  if (!eventName) return null;

  const eventType = raw.eventType;
  if (!EVENT_KINDS.has(eventType)) return null;

  const cityName =
    typeof raw.cityName === "string" && raw.cityName.trim().length > 0
      ? raw.cityName.trim()
      : null;
  if (!cityName) return null;

  const latitude =
    typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
      ? raw.latitude
      : null;
  const longitude =
    typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
      ? raw.longitude
      : null;

  return {
    id: raw.id.trim(),
    eventName,
    eventType,
    cityName,
    latitude,
    longitude,
  };
}
