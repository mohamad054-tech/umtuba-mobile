import { useEffect, useReducer, useRef } from "react";

import type { MapLibreRendererAdapter } from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import {
  resolveWorldZoomBucket,
  WORLD_ZOOM_BUCKET_STEP,
} from "@/src/lib/world/renderer/maplibre/visualQuality";

/**
 * Subscribe to adapter surface + zoom-bucket changes without remounting camera.
 */
export function useMapLibreLayerState(adapter: MapLibreRendererAdapter): {
  surfaceRevision: number;
  zoomBucket: number;
} {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const zoomBucketRef = useRef(
    resolveWorldZoomBucket(adapter.getSessionCamera().zoom)
  );

  useEffect(() => {
    return adapter.subscribe(() => {
      const nextBucket = resolveWorldZoomBucket(
        adapter.getSessionCamera().zoom,
        WORLD_ZOOM_BUCKET_STEP
      );
      if (nextBucket !== zoomBucketRef.current) {
        zoomBucketRef.current = nextBucket;
      }
      bump();
    });
  }, [adapter]);

  return {
    surfaceRevision: adapter.getSurfaceRevision(),
    zoomBucket: zoomBucketRef.current,
  };
}
