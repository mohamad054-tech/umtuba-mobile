/**
 * Places bottom-sheet view model — Runtime builds this; UI renders only.
 * Only real identity fields are exposed (no placeholder metrics).
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
  /** Null = no trusted value (omit from product UI). */
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
    metrics: [],
  };
}
