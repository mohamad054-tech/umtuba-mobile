import { describe, expect, it } from "vitest";

import {
  createMapLibreRendererAdapter,
  createWorldRuntimeController,
  DEMO_MAP_STYLE_URL,
  isMapLibreRendererAdapter,
  MAPLIBRE_DEFAULT_CAMERA,
  STREET_MAP_SOURCE_ID,
  SATELLITE_MAP_SOURCE_ID,
} from "@/src/lib/world";
import {
  clearLayerCache,
  getCachedGeoJSON,
  markersSignature,
  markersUnchanged,
} from "@/src/lib/world/renderer/maplibre/layerCache";
import {
  createWorldRuntimeMetrics,
} from "@/src/lib/world/runtime/metrics";
import {
  CLUSTER_EXPAND_ANIMATION_MS,
  isPlaceLabelVisibleForTier,
  PLACE_LABEL_MIN_ZOOM_BY_TIER,
  resolveClusterExpandZoom,
  resolveRoadsZoomBucket,
  resolveWorldZoomBucket,
  shouldRefreshForZoomBucket,
} from "@/src/lib/world/renderer/maplibre/visualQuality";

describe("visual quality helpers", () => {
  it("buckets zoom to reduce layer refresh churn", () => {
    expect(resolveWorldZoomBucket(4.12)).toBe(4.2);
    expect(shouldRefreshForZoomBucket(4.2, 4.31)).toBe(false);
    expect(shouldRefreshForZoomBucket(4.2, 4.55)).toBe(true);
  });

  it("prioritizes capital labels before minor cities", () => {
    expect(
      isPlaceLabelVisibleForTier(
        PLACE_LABEL_MIN_ZOOM_BY_TIER.capital,
        "capital"
      )
    ).toBe(true);
    expect(
      isPlaceLabelVisibleForTier(
        PLACE_LABEL_MIN_ZOOM_BY_TIER.major,
        "minor"
      )
    ).toBe(false);
  });

  it("expands clusters smoothly without large jumps", () => {
    const target = resolveClusterExpandZoom(3.2, 5);
    expect(target).toBeGreaterThan(3.2);
    expect(target).toBeLessThan(6.5);
    expect(CLUSTER_EXPAND_ANIMATION_MS).toBeGreaterThan(0);
  });

  it("coarsens roads zoom bucket at far zoom", () => {
    expect(resolveRoadsZoomBucket(3.4)).toBe(3);
    expect(resolveRoadsZoomBucket(11.3)).toBe(11);
  });
});

describe("layer cache", () => {
  it("reuses GeoJSON when marker signature unchanged", () => {
    clearLayerCache();
    const markers = [{ id: "a", latitude: 1, longitude: 2 }];
    const sig = markersSignature(markers, null);
    const first = getCachedGeoJSON("test", sig, () => ({
      type: "FeatureCollection",
      features: [],
    }));
    const second = getCachedGeoJSON("test", sig, () => ({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: {} }],
    }));
    expect(second).toBe(first);
    clearLayerCache();
  });

  it("detects unchanged marker id lists", () => {
    expect(
      markersUnchanged([{ id: "a" }, { id: "b" }], [{ id: "a" }, { id: "b" }])
    ).toBe(true);
    expect(markersUnchanged([{ id: "a" }], [{ id: "b" }])).toBe(false);
  });
});

describe("renderer performance revisions", () => {
  it("bumps surface revision without remounting camera on marker sync", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    adapter.reportStyleLoaded();
    const cameraBefore = adapter.getCameraRevision();
    const surfaceBefore = adapter.getSurfaceRevision();
    adapter.setPlaceMarkers([
      {
        id: "place-amman",
        name: "Amman",
        countryName: "Jordan",
        kindLabel: "Capital",
        cityTier: "capital",
        layerId: "cities_capitals",
        latitude: 31.95,
        longitude: 35.93,
      },
    ]);
    expect(adapter.getCameraRevision()).toBe(cameraBefore);
    expect(adapter.getSurfaceRevision()).toBeGreaterThan(surfaceBefore);
  });

  it("bumps camera revision on programmatic focus only", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    adapter.reportStyleLoaded();
    const surfaceBefore = adapter.getSurfaceRevision();
    adapter.focusPlaceAt(31.95, 35.93, 6);
    expect(adapter.getCameraRevision()).toBeGreaterThan(0);
    expect(adapter.getSurfaceRevision()).toBe(surfaceBefore);
  });

  it("marks style transition during source swap", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: "https://example.com/style-a.json",
    });
    adapter.mount();
    adapter.reportStyleLoaded();
    expect(adapter.isStyleTransitioning()).toBe(false);
    adapter.setStyleUrl("https://example.com/style-b.json");
    expect(adapter.isStyleTransitioning()).toBe(true);
    adapter.reportStyleLoaded();
    expect(adapter.isStyleTransitioning()).toBe(false);
  });

  it("cleans marker memory on unmount", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    adapter.setPlaceMarkers([
      {
        id: "place-amman",
        name: "Amman",
        countryName: "Jordan",
        kindLabel: "Capital",
        cityTier: "capital",
        layerId: "cities_capitals",
        latitude: 31.95,
        longitude: 35.93,
      },
    ]);
    adapter.unmount();
    expect(adapter.getPlaceMarkers()).toEqual([]);
  });
});

describe("runtime metrics", () => {
  it("records in-process timings without external telemetry", () => {
    const metrics = createWorldRuntimeMetrics();
    metrics.markStart("world_open_ms");
    metrics.markEnd("world_open_ms");
    metrics.record("layer_update_ms", 12);
    const snapshot = metrics.getSnapshot();
    expect(snapshot.worldOpenMs).not.toBeNull();
    expect(snapshot.layerUpdateMs).toBe(12);
    expect(Object.keys(snapshot.samples)).not.toContain("telemetry");
  });

  it("records map source switch duration", async () => {
    const controller = createWorldRuntimeController({
      mapSourceId: STREET_MAP_SOURCE_ID,
      yieldMs: 0,
    });
    await controller.start();
    controller.setMapSourceId(SATELLITE_MAP_SOURCE_ID);
    const metrics = controller.getMetrics();
    expect(metrics.mapSourceSwitchMs).not.toBeNull();
  });

  it("preserves camera and layers across source switch without reinit", async () => {
    const controller = createWorldRuntimeController({
      mapSourceId: STREET_MAP_SOURCE_ID,
      yieldMs: 0,
    });
    await controller.start();
    const attempt = controller.getRuntimeState().attempt;
    const renderer = controller.getRendererAdapter();
    if (!isMapLibreRendererAdapter(renderer)) throw new Error("maplibre");
    renderer.getCameraAdapter().setCamera({
      ...MAPLIBRE_DEFAULT_CAMERA,
      zoom: 7,
    });
    if (!renderer.getLayerAdapter().isLayerVisible("users")) {
      controller.toggleLayer("users", true);
    }
    const cam = renderer.getSessionCamera();
    controller.setMapSourceId(STREET_MAP_SOURCE_ID);
    expect(controller.getRuntimeState().attempt).toBe(attempt);
    expect(renderer.getSessionCamera()).toEqual(cam);
    expect(renderer.getLayerAdapter().isLayerVisible("users")).toBe(true);
  });
});
