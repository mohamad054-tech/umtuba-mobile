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

const PLACEHOLDER_META: WorldEventSheetMeta[] = [
  { id: "date", label: "Date", value: null, placeholder: "Coming soon" },
  { id: "organizer", label: "Organizer", value: null, placeholder: "Coming soon" },
];

const PLACEHOLDER_ACTIONS: WorldEventSheetAction[] = [
  {
    id: "view_event",
    label: "View Event",
    enabled: false,
    placeholder: "Coming soon",
  },
];

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
    meta: PLACEHOLDER_META.map((m) => ({ ...m })),
    actions: PLACEHOLDER_ACTIONS.map((a) => ({ ...a })),
  };
}
