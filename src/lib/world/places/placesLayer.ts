import { formatWorldPlaceKindLabel } from "@/src/lib/world/places/types";
import type { WorldPlace } from "@/src/lib/world/places/types";
import {
  placeLayerIdForTier,
  resolvePlaceCityTier,
  type WorldPlaceCityTier,
  type WorldPlaceLayerId,
} from "@/src/lib/world/places/placeUx";
import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";

export const WORLD_PLACES_LAYER_REF = "world-places-layer" as const;

/** Snapshot layer entry so Cities category can enable when places are bound. */
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

export function createWorldPlacesSubLayerDefinitions(): WorldLayer[] {
  return [
    {
      id: "world-places-capitals",
      kind: "pins",
      category: "cities",
      label: "Capitals",
      visible: true,
      interactive: true,
      zIndex: 23,
      sourceRef: "places-capitals",
    },
    {
      id: "world-places-major",
      kind: "pins",
      category: "cities",
      label: "Major Cities",
      visible: true,
      interactive: true,
      zIndex: 22,
      sourceRef: "places-major",
    },
    {
      id: "world-places-minor",
      kind: "pins",
      category: "cities",
      label: "Minor Cities",
      visible: true,
      interactive: true,
      zIndex: 21,
      sourceRef: "places-minor",
    },
  ];
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
  cityTier: WorldPlaceCityTier;
  layerId: WorldPlaceLayerId;
  latitude: number;
  longitude: number;
};

export function worldPlaceToMarker(place: WorldPlace): WorldPlaceMarker {
  const cityTier = resolvePlaceCityTier(place);
  return {
    id: place.id,
    name: place.name,
    countryName: place.countryName,
    kindLabel: formatWorldPlaceKindLabel(place.kind),
    cityTier,
    layerId: placeLayerIdForTier(cityTier),
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

export function worldPlacesToMarkers(places: WorldPlace[]): WorldPlaceMarker[] {
  return places.map(worldPlaceToMarker);
}

export function filterMarkersByPlaceLayers(
  markers: WorldPlaceMarker[],
  activeLayers: WorldPlaceLayerId[]
): WorldPlaceMarker[] {
  const active = new Set(activeLayers);
  return markers.filter((m) => active.has(m.layerId));
}

/** GeoJSON FeatureCollection for MapLibre clustering layers. */
export function placesMarkersToGeoJSON(
  markers: WorldPlaceMarker[],
  selectedId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: markers.map((m) => ({
      type: "Feature",
      id: m.id,
      properties: {
        id: m.id,
        name: m.name,
        countryName: m.countryName,
        kindLabel: m.kindLabel,
        cityTier: m.cityTier,
        layerId: m.layerId,
        selected: selectedId === m.id ? 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [m.longitude, m.latitude],
      },
    })),
  };
}
