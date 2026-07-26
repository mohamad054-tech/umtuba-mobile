import { describe, expect, it } from "vitest";

import {
  createNullRendererAdapter,
  createWorldRuntimeController,
  defaultNullRendererCapabilities,
  isRendererAdapterBound,
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

describe("runtime + renderer integration", () => {
  it("owns null renderer by default and keeps UI path fail-closed", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
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
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(() => controller.toggleLayer("events", true)).not.toThrow();
    expect(
      controller.getRendererAdapter().getLayerAdapter().isLayerVisible("events")
    ).toBe(false);
  });
});
