/**
 * Places bottom-sheet view model — Runtime builds this; UI renders only.
 * Population/Users/Education/Events/Games stay placeholders until trusted sources bind.
 */

import {
  formatWorldPlaceKindLabel,
  type WorldPlace,
  type WorldPlaceCityTier,
} from "@/src/lib/world/places/types";
import { resolvePlaceCityTier } from "@/src/lib/world/places/placeUx";

export type WorldPlaceSheetMetricId =
  | "population"
  | "users"
  | "education"
  | "events"
  | "games";

export type WorldPlaceSheetMetric = {
  id: WorldPlaceSheetMetricId;
  label: string;
  /** Null = placeholder (fail-closed, no invented counts). */
  value: string | null;
  placeholder: string;
};

export type WorldPlaceSheetState = {
  placeId: string;
  name: string;
  countryName: string;
  kindLabel: string;
  cityTier: WorldPlaceCityTier;
  open: boolean;
  metrics: WorldPlaceSheetMetric[];
};

const PLACEHOLDER_METRICS: WorldPlaceSheetMetric[] = [
  {
    id: "population",
    label: "Population",
    value: null,
    placeholder: "Coming soon",
  },
  {
    id: "users",
    label: "Users",
    value: null,
    placeholder: "Coming soon",
  },
  {
    id: "education",
    label: "Education",
    value: null,
    placeholder: "Coming soon",
  },
  {
    id: "events",
    label: "Events",
    value: null,
    placeholder: "Coming soon",
  },
  {
    id: "games",
    label: "Games",
    value: null,
    placeholder: "Coming soon",
  },
];

export function buildWorldPlaceSheetState(
  place: WorldPlace | null,
  open: boolean
): WorldPlaceSheetState | null {
  if (!place || !open) return null;
  return {
    placeId: place.id,
    name: place.name,
    countryName: place.countryName,
    kindLabel: formatWorldPlaceKindLabel(place.kind),
    cityTier: resolvePlaceCityTier(place),
    open: true,
    metrics: PLACEHOLDER_METRICS.map((m) => ({ ...m })),
  };
}
