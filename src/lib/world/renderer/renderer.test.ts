import { describe, expect, it } from "vitest";

import {
  createMapLibreRendererAdapter,
  createNullRendererAdapter,
  createWorldRuntimeController,
  defaultNullRendererCapabilities,
  DEMO_MAP_STYLE_URL,
  isMapLibreRendererAdapter,
  isRendererAdapterBound,
  MAPLIBRE_DEFAULT_CAMERA,
  MAPLIBRE_RENDERER_ID,
} from "@/src/lib/world";

describe("null renderer adapter", () => {
  it("is unbound, fail-closed, and exposes empty capabilities", () => {
    const adapter = createNullRendererAdapter();
    expect(adapter.id).toBe("world-renderer-none");
    expect(adapter.family).toBe("none");
    expect(adapter.isBound()).toBe(false);
    expect(isRendererAdapterBound(adapter)).toBe(false);

    const caps = adapter.getCapabilities();
    expect(caps).toEqual(defaultNullRendererCapabilities());
    expect(caps.supports3D).toBe(false);
    expect(caps.supportsTerrain).toBe(false);
    expect(caps.supportsOffline).toBe(false);
    expect(caps.supportsStreetLabels).toBe(false);
    expect(caps.supportsSatellite).toBe(false);
    expect(caps.supportsCustomLayers).toBe(false);
    expect(caps.supportsBuildings).toBe(false);

    expect(adapter.getCameraAdapter().zoomIn()).toBe(false);
    expect(adapter.getCameraAdapter().getCamera()).toBeNull();
    expect(adapter.getLayerAdapter().listLayerIds()).toEqual([]);
    expect(adapter.getProjectionAdapter().project(0, 0)).toBeNull();

    expect(() => adapter.mount()).not.toThrow();
    expect(() => adapter.unmount()).not.toThrow();
    expect(JSON.stringify(adapter.getCapabilities())).not.toMatch(
      /maplibre|mapbox|google|cesium|pmtiles/i
    );
  });
});

describe("MapLibre renderer adapter", () => {
  it("implements World/Camera/Layer/Projection adapters with injected style", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    expect(adapter.id).toBe(MAPLIBRE_RENDERER_ID);
    expect(adapter.family).toBe("vector_2d");
    expect(isMapLibreRendererAdapter(adapter)).toBe(true);
    expect(adapter.getStyleUrl()).toBe(DEMO_MAP_STYLE_URL);
    expect(adapter.isBound()).toBe(false);

    adapter.mount();
    expect(adapter.isBound()).toBe(true);
    expect(isRendererAdapterBound(adapter)).toBe(true);
    expect(adapter.getMountGeneration()).toBe(1);

    const caps = adapter.getCapabilities();
    expect(caps.supports3D).toBe(true);
    expect(caps.supportsStreetLabels).toBe(true);
    expect(caps.supportsOffline).toBe(false);

    const camera = adapter.getCameraAdapter();
    expect(camera.getCamera()).toEqual(MAPLIBRE_DEFAULT_CAMERA);
    expect(camera.zoomIn()).toBe(true);
    expect(camera.getCamera()?.zoom).toBe(MAPLIBRE_DEFAULT_CAMERA.zoom + 1);
    expect(camera.zoomOut()).toBe(true);
    expect(camera.recenter()).toBe(true);
    expect(camera.getCamera()).toEqual(MAPLIBRE_DEFAULT_CAMERA);
    expect(camera.resetOrientation()).toBe(true);

    const layers = adapter.getLayerAdapter();
    expect(layers.listLayerIds().length).toBeGreaterThan(0);
    expect(layers.setLayerVisibility("events", true)).toBe(true);
    expect(layers.isLayerVisible("events")).toBe(true);

    expect(adapter.getProjectionAdapter().project(0, 0)).toBeNull();
    expect(adapter.getProjectionAdapter().unproject(0, 0)).toBeNull();
  });

  it("fail-closes without a style URL (no hardcoded tiles)", () => {
    const adapter = createMapLibreRendererAdapter();
    expect(adapter.getStyleUrl()).toBe("");
    adapter.mount();
    expect(adapter.isBound()).toBe(false);
    expect(adapter.getCameraAdapter().zoomIn()).toBe(false);
    expect(adapter.getLoadError()).toMatch(/not configured/i);
  });

  it("fail-closes on style failure and remounts cleanly for Retry", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    expect(adapter.getMountGeneration()).toBe(1);
    adapter.reportStyleLoaded();
    expect(adapter.isStyleReady()).toBe(true);

    adapter.reportStyleFailed("tiles down");
    expect(adapter.isBound()).toBe(false);
    expect(adapter.getLoadError()).toBe("tiles down");
    expect(adapter.getCameraAdapter().zoomIn()).toBe(false);

    adapter.mount();
    expect(adapter.getMountGeneration()).toBe(2);
    expect(adapter.getLoadError()).toBeNull();
    expect(adapter.isStyleReady()).toBe(false);
    expect(adapter.isBound()).toBe(true);
  });

  it("syncs pan from map without bumping camera revision", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    const before = adapter.getCameraRevision();
    adapter.syncCameraFromMap({
      latitude: 10,
      longitude: 20,
      zoom: 4,
    });
    expect(adapter.getCameraRevision()).toBe(before);
    expect(adapter.getCameraAdapter().getCamera()?.latitude).toBe(10);
    expect(adapter.getCameraAdapter().getCamera()?.longitude).toBe(20);
    expect(adapter.getCameraAdapter().getCamera()?.zoom).toBe(4);
  });

  it("does not embed demotiles URL in adapter module defaults", () => {
    const adapter = createMapLibreRendererAdapter({ styleUrl: "https://example.test/style.json" });
    expect(adapter.getStyleUrl()).toBe("https://example.test/style.json");
    expect(adapter.getStyleUrl()).not.toContain("demotiles.maplibre.org");
  });
});

describe("runtime + renderer integration", () => {
  it("owns null renderer when explicitly overridden", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      renderer: null,
    });
    const renderer = controller.getRendererAdapter();
    expect(renderer.isBound()).toBe(false);
    expect(controller.getRuntimeState().rendererBound).toBe(false);

    await controller.start();
    expect(controller.getRuntimeState().rendererBound).toBe(false);
    expect(controller.getViewState().rendererBound).toBe(false);
    expect(controller.getRendererAdapter().getCapabilities().supports3D).toBe(
      false
    );
  });

  it("routes layer toggles through renderer layer adapter without crash", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      renderer: createNullRendererAdapter(),
    });
    await controller.start();
    expect(() => controller.toggleLayer("events", true)).not.toThrow();
    expect(
      controller.getRendererAdapter().getLayerAdapter().isLayerVisible("events")
    ).toBe(false);
  });

  it("binds MapLibre through Runtime Map Source and routes camera + retry", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);

    await controller.start();
    expect(controller.getRendererAdapter().id).toBe(MAPLIBRE_RENDERER_ID);
    expect(controller.getRuntimeState().rendererBound).toBe(true);
    expect(controller.getRuntimeState().mapSourceBound).toBe(true);
    expect(controller.getViewState().rendererBound).toBe(true);
    expect(controller.getViewState().cameraControls.every((c) => c.enabled)).toBe(
      true
    );

    expect(controller.applyCameraControl("zoom_in")).toBe(true);
    expect(renderer.getCameraAdapter().getCamera()?.zoom).toBe(
      MAPLIBRE_DEFAULT_CAMERA.zoom + 1
    );
    expect(controller.applyCameraControl("zoom_out")).toBe(true);
    expect(controller.applyCameraControl("recenter")).toBe(true);
    expect(renderer.getCameraAdapter().getCamera()).toEqual(
      MAPLIBRE_DEFAULT_CAMERA
    );

    controller.toggleLayer("games", true);
    expect(renderer.getLayerAdapter().isLayerVisible("games")).toBe(false);
    controller.toggleLayer("games", true);
    expect(renderer.getLayerAdapter().isLayerVisible("games")).toBe(true);

    controller.toggleLayer("businesses", true);
    expect(renderer.getLayerAdapter().isLayerVisible("businesses")).toBe(false);
    controller.toggleLayer("businesses", true);
    expect(renderer.getLayerAdapter().isLayerVisible("businesses")).toBe(true);

    controller.toggleLayer("events", true);
    expect(renderer.getLayerAdapter().isLayerVisible("events")).toBe(false);
    controller.toggleLayer("events", true);
    expect(renderer.getLayerAdapter().isLayerVisible("events")).toBe(true);

    if (!isMapLibreRendererAdapter(renderer)) {
      throw new Error("expected MapLibre adapter");
    }
    renderer.reportStyleFailed("offline");
    expect(controller.getRendererAdapter().isBound()).toBe(false);
    const genBefore = renderer.getMountGeneration();
    await controller.retry();
    expect(renderer.getMountGeneration()).toBe(genBefore + 1);
    expect(renderer.getLoadError()).toBeNull();
  });
});
