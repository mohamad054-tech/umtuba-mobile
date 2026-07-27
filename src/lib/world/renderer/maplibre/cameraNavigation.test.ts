import { describe, expect, it } from "vitest";

import {
  clampMapLibreZoom,
  createMapLibreRendererAdapter,
  createWorldRuntimeController,
  DEMO_MAP_STYLE_URL,
  getMapLibreZoomLimits,
  isMapLibreRendererAdapter,
  MAPLIBRE_CAMERA_MAX_ZOOM,
  MAPLIBRE_CAMERA_MIN_ZOOM,
  MAPLIBRE_DEFAULT_CAMERA,
  normalizeMapLibreCamera,
} from "@/src/lib/world";

describe("MapLibre camera navigation helpers", () => {
  it("clamps zoom to operational min/max", () => {
    expect(clampMapLibreZoom(-5)).toBe(MAPLIBRE_CAMERA_MIN_ZOOM);
    expect(clampMapLibreZoom(99)).toBe(MAPLIBRE_CAMERA_MAX_ZOOM);
    expect(clampMapLibreZoom(5)).toBe(5);
    expect(clampMapLibreZoom(Number.NaN)).toBe(MAPLIBRE_DEFAULT_CAMERA.zoom);
    expect(getMapLibreZoomLimits()).toEqual({
      minZoom: MAPLIBRE_CAMERA_MIN_ZOOM,
      maxZoom: MAPLIBRE_CAMERA_MAX_ZOOM,
    });
  });

  it("normalizes session camera snapshots fail-closed", () => {
    const cam = normalizeMapLibreCamera({
      latitude: 10,
      longitude: 20,
      zoom: 50,
      bearing: 15,
      pitch: 90,
    });
    expect(cam.latitude).toBe(10);
    expect(cam.longitude).toBe(20);
    expect(cam.zoom).toBe(MAPLIBRE_CAMERA_MAX_ZOOM);
    expect(cam.pitch).toBe(60);
  });
});

describe("MapLibre session camera + navigation", () => {
  it("persists last center/zoom across gesture sync and remount", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    adapter.syncCameraFromMap({
      latitude: 31.95,
      longitude: 35.91,
      zoom: 8,
      bearing: 12,
      pitch: 0,
    });
    expect(adapter.getSessionCamera()).toMatchObject({
      latitude: 31.95,
      longitude: 35.91,
      zoom: 8,
      bearing: 12,
    });
    const revisionBefore = adapter.getCameraRevision();
    const surfaceBefore = adapter.getSurfaceRevision();
    adapter.mount(); // Retry remount
    expect(adapter.getMountGeneration()).toBe(2);
    expect(adapter.getSessionCamera()).toMatchObject({
      latitude: 31.95,
      longitude: 35.91,
      zoom: 8,
    });
    // Gesture sync must not remount Camera; remount bumps surface revision only.
    expect(adapter.getCameraRevision()).toBe(revisionBefore);
    expect(adapter.getSurfaceRevision()).toBeGreaterThan(surfaceBefore);
  });

  it("enforces zoom limits on CameraAdapter controls", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    const camera = adapter.getCameraAdapter();
    expect(
      camera.setCamera({
        ...MAPLIBRE_DEFAULT_CAMERA,
        zoom: 100,
      })
    ).toBe(true);
    expect(camera.getCamera()?.zoom).toBe(MAPLIBRE_CAMERA_MAX_ZOOM);
    expect(camera.zoomIn()).toBe(false);

    expect(
      camera.setCamera({
        ...MAPLIBRE_DEFAULT_CAMERA,
        zoom: 0,
      })
    ).toBe(true);
    expect(camera.getCamera()?.zoom).toBe(MAPLIBRE_CAMERA_MIN_ZOOM);
    expect(camera.zoomOut()).toBe(false);
  });

  it("recenter restores default camera for the session", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    adapter.syncCameraFromMap({ latitude: 40, longitude: 10, zoom: 6 });
    expect(adapter.getCameraAdapter().recenter()).toBe(true);
    expect(adapter.getSessionCamera()).toEqual(MAPLIBRE_DEFAULT_CAMERA);
  });

  it("fail-closes navigation when renderer has no style", () => {
    const adapter = createMapLibreRendererAdapter();
    adapter.mount();
    expect(adapter.getCameraAdapter().zoomIn()).toBe(false);
    expect(adapter.getCameraAdapter().getCamera()).toBeNull();
    expect(adapter.getSessionCamera()).toEqual(MAPLIBRE_DEFAULT_CAMERA);
  });
});

describe("Runtime camera control path", () => {
  it("routes pan-session state and toolbar controls via CameraAdapter only", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    renderer.syncCameraFromMap({ latitude: 25, longitude: 45, zoom: 4 });
    expect(renderer.getSessionCamera().latitude).toBe(25);
    expect(controller.applyCameraControl("zoom_in")).toBe(true);
    expect(renderer.getSessionCamera().zoom).toBe(5);
    expect(controller.applyCameraControl("recenter")).toBe(true);
    expect(renderer.getSessionCamera()).toEqual(MAPLIBRE_DEFAULT_CAMERA);
  });
});
