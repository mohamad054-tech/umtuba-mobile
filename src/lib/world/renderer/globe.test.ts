import { describe, expect, it } from "vitest";

import {
  buildWorldProjectionControls,
  defaultNullRendererCapabilities,
} from "@/src/lib/world";
import {
  createMapLibreRendererAdapter,
  createNullRendererAdapter,
  createWorldRuntimeController,
  DEMO_MAP_STYLE_URL,
  GLOBE_AUTO_MAX_ZOOM,
  MAPLIBRE_DEFAULT_CAMERA,
  MERCATOR_AUTO_MIN_ZOOM,
  resolveAutoProjection,
  toFoundationRendererCapability,
  type CameraAdapter,
  type LayerAdapter,
  type ProjectionAdapter,
  type RendererCapabilities,
  type WorldMapProjection,
  type WorldRendererAdapter,
} from "@/src/lib/world";
import type { WorldCamera } from "@/src/lib/world/types";

type GlobeTestRendererOptions = {
  supportsGlobe?: boolean;
  initialZoom?: number;
  styleUrl?: string;
};

/**
 * Test renderer with subscribe + globe-capable projection (MapLibre-like surface contract).
 */
function createGlobeTestRenderer(
  options?: GlobeTestRendererOptions
): WorldRendererAdapter & {
  subscribe(listener: () => void): () => void;
  getSessionCamera(): WorldCamera;
  syncCameraFromMap(partial: Partial<WorldCamera>): void;
} {
  const supportsGlobe = options?.supportsGlobe ?? true;
  let projection: WorldMapProjection = "mercator";
  let sessionCamera: WorldCamera = {
    ...MAPLIBRE_DEFAULT_CAMERA,
    zoom: options?.initialZoom ?? MAPLIBRE_DEFAULT_CAMERA.zoom,
  };
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const caps: RendererCapabilities = {
    supports3D: true,
    supportsTerrain: false,
    supportsOffline: false,
    supportsStreetLabels: true,
    supportsSatellite: true,
    supportsCustomLayers: true,
    supportsBuildings: false,
    supportsGlobe,
    supportsProjectionSwitch: true,
  };

  const cameraAdapter: CameraAdapter = {
    id: "world-camera-test",
    getCamera(): WorldCamera | null {
      return { ...sessionCamera };
    },
    setCamera(next: WorldCamera): boolean {
      sessionCamera = { ...next };
      emit();
      return true;
    },
    zoomIn(): boolean {
      sessionCamera = { ...sessionCamera, zoom: sessionCamera.zoom + 1 };
      emit();
      return true;
    },
    zoomOut(): boolean {
      sessionCamera = { ...sessionCamera, zoom: sessionCamera.zoom - 1 };
      emit();
      return true;
    },
    recenter(): boolean {
      sessionCamera = { ...MAPLIBRE_DEFAULT_CAMERA };
      emit();
      return true;
    },
    resetOrientation(): boolean {
      sessionCamera = { ...sessionCamera, bearing: 0, pitch: 0 };
      emit();
      return true;
    },
  };

  const layerAdapter: LayerAdapter = {
    id: "world-layer-test",
    listLayerIds(): string[] {
      return ["cities"];
    },
    setLayerVisibility(): boolean {
      return true;
    },
    isLayerVisible(): boolean {
      return false;
    },
  };

  const projectionAdapter: ProjectionAdapter = {
    id: "world-projection-test",
    getProjection(): WorldMapProjection {
      return projection;
    },
    setProjection(mode: WorldMapProjection): boolean {
      if (mode === projection) return true;
      if (mode === "globe" && !supportsGlobe) return false;
      projection = mode;
      emit();
      return true;
    },
    project(): null {
      return null;
    },
    unproject(): null {
      return null;
    },
  };

  let mounted = false;

  return {
    id: "world-renderer-test-globe",
    family: "vector_2d",
    isBound(): boolean {
      return mounted;
    },
    getCapabilities(): RendererCapabilities {
      return { ...caps };
    },
    getCameraAdapter(): CameraAdapter {
      return cameraAdapter;
    },
    getLayerAdapter(): LayerAdapter {
      return layerAdapter;
    },
    getProjectionAdapter(): ProjectionAdapter {
      return projectionAdapter;
    },
    mount(): void {
      mounted = true;
      emit();
    },
    unmount(): void {
      mounted = false;
      emit();
    },
    capability: toFoundationRendererCapability("vector_2d", caps),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSessionCamera(): WorldCamera {
      return { ...sessionCamera };
    },
    syncCameraFromMap(partial: Partial<WorldCamera>): void {
      sessionCamera = { ...sessionCamera, ...partial };
      emit();
    },
  };
}

describe("resolveAutoProjection hysteresis", () => {
  it("prefers globe at or below GLOBE_AUTO_MAX_ZOOM", () => {
    expect(resolveAutoProjection(GLOBE_AUTO_MAX_ZOOM, "mercator")).toBe("globe");
    expect(resolveAutoProjection(2, "mercator")).toBe("globe");
  });

  it("prefers mercator at or above MERCATOR_AUTO_MIN_ZOOM", () => {
    expect(resolveAutoProjection(MERCATOR_AUTO_MIN_ZOOM, "globe")).toBe(
      "mercator"
    );
    expect(resolveAutoProjection(8, "globe")).toBe("mercator");
  });

  it("keeps current projection in the hysteresis band", () => {
    expect(resolveAutoProjection(4.5, "globe")).toBe("globe");
    expect(resolveAutoProjection(4.5, "mercator")).toBe("mercator");
  });
});

describe("renderer projection capabilities", () => {
  it("null renderer has supportsGlobe and supportsProjectionSwitch false", () => {
    const caps = createNullRendererAdapter().getCapabilities();
    expect(caps.supportsGlobe).toBe(false);
    expect(caps.supportsProjectionSwitch).toBe(false);
    expect(caps).toEqual(defaultNullRendererCapabilities());
  });

  it("MapLibre has supportsProjectionSwitch true and supportsGlobe false", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    const caps = adapter.getCapabilities();
    expect(caps.supportsProjectionSwitch).toBe(true);
    expect(caps.supportsGlobe).toBe(false);
  });
});

describe("MapLibre projection adapter fail-closed", () => {
  it("setProjection globe returns false and stays mercator", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    const before = adapter.getSessionCamera();
    const projection = adapter.getProjectionAdapter();
    expect(projection.getProjection()).toBe("mercator");
    expect(projection.setProjection("globe")).toBe(false);
    expect(projection.getProjection()).toBe("mercator");
    expect(adapter.getSessionCamera()).toEqual(before);
    expect(adapter.getPlaceMarkers()).toEqual([]);
  });

  it("setProjection mercator returns true", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    const projection = adapter.getProjectionAdapter();
    expect(projection.setProjection("mercator")).toBe(true);
    expect(projection.getProjection()).toBe("mercator");
  });

  it("does not throw on projection calls", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: DEMO_MAP_STYLE_URL,
    });
    adapter.mount();
    const projection = adapter.getProjectionAdapter();
    expect(() => projection.setProjection("globe")).not.toThrow();
    expect(() => projection.setProjection("mercator")).not.toThrow();
  });
});

describe("buildWorldProjectionControls", () => {
  it("disables globe when unsupported with reason", () => {
    const caps = defaultNullRendererCapabilities();
    const controls = buildWorldProjectionControls(caps, "auto", "mercator");
    const globe = controls.find((c) => c.id === "globe");
    const map = controls.find((c) => c.id === "map");
    expect(globe?.enabled).toBe(false);
    expect(globe?.reason).toMatch(/not available/i);
    expect(map?.enabled).toBe(true);
    expect(map?.active).toBe(true);
  });

  it("enables globe when supported", () => {
    const caps = {
      ...defaultNullRendererCapabilities(),
      supportsGlobe: true,
      supportsProjectionSwitch: true,
    };
    const controls = buildWorldProjectionControls(caps, "globe", "globe");
    expect(controls.find((c) => c.id === "globe")?.enabled).toBe(true);
    expect(controls.find((c) => c.id === "globe")?.active).toBe(true);
  });
});

describe("runtime projection policy", () => {
  it("manual setProjectionPreference globe and map", async () => {
    const renderer = createGlobeTestRenderer({ supportsGlobe: true });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      renderer,
    });
    await controller.start();
    expect(controller.getProjectionPreference()).toBe("auto");

    expect(controller.setProjectionPreference("globe")).toBe(true);
    expect(controller.getProjectionPreference()).toBe("globe");
    expect(controller.getActiveProjection()).toBe("globe");

    expect(controller.setProjectionPreference("map")).toBe(true);
    expect(controller.getProjectionPreference()).toBe("map");
    expect(controller.getActiveProjection()).toBe("mercator");
  });

  it("auto switches projection by zoom without reinit", async () => {
    const renderer = createGlobeTestRenderer({
      supportsGlobe: true,
      initialZoom: 3,
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      renderer,
    });
    await controller.start();
    const attemptAfterStart = controller.getRuntimeState().attempt;
    expect(controller.getActiveProjection()).toBe("globe");

    renderer.syncCameraFromMap({ zoom: 6 });
    controller.notifyCameraChanged();
    expect(controller.getActiveProjection()).toBe("mercator");

    renderer.syncCameraFromMap({ zoom: 3 });
    controller.notifyCameraChanged();
    expect(controller.getActiveProjection()).toBe("globe");
    expect(controller.getRuntimeState().attempt).toBe(attemptAfterStart);
  });

  it("fallback when globe unsupported keeps mercator", async () => {
    const renderer = createGlobeTestRenderer({ supportsGlobe: false });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      renderer,
    });
    await controller.start();
    expect(controller.setProjectionPreference("globe")).toBe(true);
    expect(controller.getActiveProjection()).toBe("mercator");
    const view = controller.getViewState();
    expect(view.activeProjection).toBe("mercator");
    expect(view.projectionControls.find((c) => c.id === "globe")?.enabled).toBe(
      false
    );
  });

  it("preserves selection, registries, map source after preference switch", async () => {
    const renderer = createGlobeTestRenderer({ supportsGlobe: true });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      renderer,
    });
    await controller.start();
    const mapSourceBefore = controller.getSelectedMapSource()?.id;
    const placesBefore = controller.getPlaceRegistry().list().length;
    const bundleBefore = controller.getLastDataBundle();

    controller.toggleLayer("cities", true);
    const place = controller.getPlaceRegistry().list()[0];
    if (place) {
      controller.selectPlace(place.id);
    }

    expect(controller.setProjectionPreference("globe")).toBe(true);
    expect(controller.getSelectedMapSource()?.id).toBe(mapSourceBefore);
    expect(controller.getPlaceRegistry().list().length).toBe(placesBefore);
    expect(controller.getLastDataBundle()).toBe(bundleBefore);
    if (place) {
      expect(controller.getSelection().selectedEntityId).toBe(place.id);
    }

    expect(controller.setProjectionPreference("map")).toBe(true);
    expect(controller.getActiveProjection()).toBe("mercator");
    if (place) {
      expect(controller.getSelection().selectedEntityId).toBe(place.id);
    }
  });

  it("MapLibre runtime stays mercator on globe preference (fail-closed)", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(controller.setProjectionPreference("globe")).toBe(true);
    expect(controller.getActiveProjection()).toBe("mercator");
    const view = controller.getViewState();
    expect(view.projectionControls.find((c) => c.id === "globe")?.enabled).toBe(
      false
    );
    expect(view.projectionControls.find((c) => c.id === "map")?.active).toBe(
      true
    );
  });
});
