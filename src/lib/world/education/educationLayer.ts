import type { WorldEducationRecord } from "@/src/lib/world/education/types";
import {
  formatWorldEducationKindLabel,
  WORLD_EDUCATION_LAYER_REF,
} from "@/src/lib/world/education/types";
import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";

/** Snapshot layer so Education category enables when provider is bound. */
export function createWorldEducationLayerDefinition(): WorldLayer {
  return {
    id: WORLD_EDUCATION_LAYER_REF,
    kind: "pins",
    category: "education",
    label: "Education",
    visible: true,
    interactive: true,
    zIndex: 30,
    sourceRef: "education-provider",
  };
}

export type WorldEducationMarker = {
  id: string;
  name: string;
  educationType: WorldEducationRecord["educationType"];
  typeLabel: string;
  cityName: string;
  latitude: number;
  longitude: number;
};

export function worldEducationToMarker(
  record: WorldEducationRecord
): WorldEducationMarker | null {
  if (
    typeof record.latitude !== "number" ||
    typeof record.longitude !== "number"
  ) {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    educationType: record.educationType,
    typeLabel: formatWorldEducationKindLabel(record.educationType),
    cityName: record.cityName,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

export function worldEducationToMarkers(
  records: WorldEducationRecord[]
): WorldEducationMarker[] {
  const out: WorldEducationMarker[] = [];
  for (const row of records) {
    const marker = worldEducationToMarker(row);
    if (marker) out.push(marker);
  }
  return out;
}

export function worldEducationToEntity(
  record: WorldEducationRecord
): WorldEntity | null {
  if (
    typeof record.latitude !== "number" ||
    typeof record.longitude !== "number"
  ) {
    return null;
  }
  return {
    id: record.id,
    kind: "education",
    category: "education",
    title: record.name,
    subtitle: `${formatWorldEducationKindLabel(record.educationType)} · ${record.cityName}`,
    latitude: record.latitude,
    longitude: record.longitude,
    destination: null,
  };
}

export function worldEducationToEntities(
  records: WorldEducationRecord[]
): WorldEntity[] {
  const out: WorldEntity[] = [];
  for (const row of records) {
    const entity = worldEducationToEntity(row);
    if (entity) out.push(entity);
  }
  return out;
}

export function educationMarkersToGeoJSON(
  markers: WorldEducationMarker[],
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
        educationType: m.educationType,
        typeLabel: m.typeLabel,
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
