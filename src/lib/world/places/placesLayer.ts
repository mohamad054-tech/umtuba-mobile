import { formatWorldPlaceKindLabel } from "@/src/lib/world/places/types";
import type { WorldPlace } from "@/src/lib/world/places/types";
import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";

export const WORLD_PLACES_LAYER_REF = "world-places-layer" as const;

/** Snapshot layer entry so Cities chip can toggle when places are bound. */
export function createWorldPlacesLayerDefinition(): WorldLayer {
  return {
    id: WORLD_PLACES_LAYER_REF,
    kind: "pins",
    category: "cities",
    label: "Cities",
    visible: true,
    interactive: true,
    zIndex: 20,
    sourceRef: "places-provider",
  };
}

/** Map a place into the experience entity view model (UI consumes this only). */
export function worldPlaceToEntity(place: WorldPlace): WorldEntity {
  const kindLabel = formatWorldPlaceKindLabel(place.kind);
  return {
    id: place.id,
    kind: "city",
    category: "cities",
    title: place.name,
    subtitle: `${place.countryName} · ${kindLabel}`,
    latitude: place.latitude,
    longitude: place.longitude,
    destination: null,
  };
}

export function worldPlacesToEntities(places: WorldPlace[]): WorldEntity[] {
  return places.map(worldPlaceToEntity);
}

/** Marker payload for the renderer — no UI imports. */
export type WorldPlaceMarker = {
  id: string;
  name: string;
  countryName: string;
  kindLabel: string;
  latitude: number;
  longitude: number;
};

export function worldPlaceToMarker(place: WorldPlace): WorldPlaceMarker {
  return {
    id: place.id,
    name: place.name,
    countryName: place.countryName,
    kindLabel: formatWorldPlaceKindLabel(place.kind),
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export function worldPlacesToMarkers(places: WorldPlace[]): WorldPlaceMarker[] {
  return places.map(worldPlaceToMarker);
}
