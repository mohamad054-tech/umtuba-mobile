/**
 * GeoJSON layer cache — reuse references when marker payloads are unchanged.
 */

type CacheEntry<T> = {
  signature: string;
  value: T;
};

const geoJsonCache = new Map<string, CacheEntry<GeoJSON.FeatureCollection>>();

export function markersSignature(
  markers: ReadonlyArray<{ id: string; latitude: number; longitude: number }>,
  selectedId: string | null
): string {
  if (markers.length === 0) return `empty:${selectedId ?? ""}`;
  const parts: string[] = [selectedId ?? ""];
  for (const m of markers) {
    parts.push(
      `${m.id}:${m.latitude.toFixed(5)}:${m.longitude.toFixed(5)}`
    );
  }
  return parts.join("|");
}

export function getCachedGeoJSON(
  cacheKey: string,
  signature: string,
  build: () => GeoJSON.FeatureCollection
): GeoJSON.FeatureCollection {
  const existing = geoJsonCache.get(cacheKey);
  if (existing && existing.signature === signature) {
    return existing.value;
  }
  const value = build();
  geoJsonCache.set(cacheKey, { signature, value });
  return value;
}

export function clearLayerCache(cacheKey?: string): void {
  if (cacheKey) {
    geoJsonCache.delete(cacheKey);
    return;
  }
  geoJsonCache.clear();
}

export function markersUnchanged<T extends { id: string }>(
  previous: T[],
  next: T[]
): boolean {
  if (previous.length !== next.length) return false;
  for (let i = 0; i < previous.length; i += 1) {
    if (previous[i]?.id !== next[i]?.id) return false;
  }
  return true;
}
