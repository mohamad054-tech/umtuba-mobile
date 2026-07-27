import type { WorldEntity, WorldLayer } from "@/src/lib/world/types";
import type { WorldCommerceRecord } from "@/src/lib/world/commerce/types";
import {
  COMMERCE_CLUSTER_MAX_ZOOM,
  formatWorldCommerceKindLabel,
  WORLD_COMMERCE_LAYER_REF,
} from "@/src/lib/world/commerce/types";

export function createWorldCommerceLayerDefinition(): WorldLayer {
  return {
    id: WORLD_COMMERCE_LAYER_REF,
    kind: "pins",
    category: "businesses",
    label: "Businesses",
    visible: true,
    interactive: true,
    zIndex: 27,
    sourceRef: "commerce-provider",
  };
}

export type WorldCommerceMarker = {
  id: string;
  name: string;
  commerceType: WorldCommerceRecord["commerceType"];
  commerceTypeLabel: string;
  cityName: string;
  brandName: string | null;
  latitude: number;
  longitude: number;
};

export function worldCommerceToMarker(
  record: WorldCommerceRecord
): WorldCommerceMarker | null {
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
    return null;
  }
  return {
    id: record.id,
    name: record.name,
    commerceType: record.commerceType,
    commerceTypeLabel: formatWorldCommerceKindLabel(record.commerceType),
    cityName: record.cityName,
    brandName: record.brandName,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

export function worldCommerceToMarkers(
  records: WorldCommerceRecord[]
): WorldCommerceMarker[] {
  const out: WorldCommerceMarker[] = [];
  for (const row of records) {
    const marker = worldCommerceToMarker(row);
    if (marker) out.push(marker);
  }
  return out;
}

export function worldCommerceToEntity(
  record: WorldCommerceRecord
): WorldEntity | null {
  if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
    return null;
  }
  const brandSuffix = record.brandName ? ` · ${record.brandName}` : "";
  return {
    id: record.id,
    kind: "business",
    category: "businesses",
    title: record.name,
    subtitle: `${formatWorldCommerceKindLabel(record.commerceType)} · ${record.cityName}${brandSuffix}`,
    latitude: record.latitude,
    longitude: record.longitude,
    destination: null,
  };
}

export function worldCommerceToEntities(
  records: WorldCommerceRecord[]
): WorldEntity[] {
  const out: WorldEntity[] = [];
  for (const row of records) {
    const entity = worldCommerceToEntity(row);
    if (entity) out.push(entity);
  }
  return out;
}

export function commerceMarkersToGeoJSON(
  markers: WorldCommerceMarker[],
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
        commerceType: m.commerceType,
        commerceTypeLabel: m.commerceTypeLabel,
        cityName: m.cityName,
        brandName: m.brandName ?? "",
        selected: selectedId === m.id ? 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [m.longitude, m.latitude],
      },
    })),
  };
}

export function isCommerceClusteringActiveAtZoom(zoom: number): boolean {
  return typeof zoom === "number" && zoom <= COMMERCE_CLUSTER_MAX_ZOOM;
}
