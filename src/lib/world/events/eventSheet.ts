import {
  formatWorldEventKindLabel,
  type WorldEventRecord,
} from "@/src/lib/world/events/types";

export type WorldEventSheetActionId = "view_event";

export type WorldEventSheetAction = {
  id: WorldEventSheetActionId;
  label: string;
  enabled: boolean;
  placeholder: string;
};

export type WorldEventSheetMetaId = "date" | "organizer";

export type WorldEventSheetMeta = {
  id: WorldEventSheetMetaId;
  label: string;
  value: string | null;
  placeholder: string;
};

export type WorldEventSheetState = {
  eventId: string;
  eventName: string;
  eventTypeLabel: string;
  cityName: string;
  open: boolean;
  meta: WorldEventSheetMeta[];
  actions: WorldEventSheetAction[];
};

export function buildWorldEventSheetState(
  record: WorldEventRecord | null,
  open: boolean
): WorldEventSheetState | null {
  if (!record || !open) return null;
  return {
    eventId: record.id,
    eventName: record.eventName,
    eventTypeLabel: formatWorldEventKindLabel(record.eventType),
    cityName: record.cityName,
    open: true,
    meta: [],
    actions: [],
  };
}
