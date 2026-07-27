import { describe, expect, it } from "vitest";

import {
  buildWorldBuildingsControls,
  buildWorldRoadDetailControls,
  createMapLibreRendererAdapter,
  createNullRendererAdapter,
  createStreetMapSource,
  createSatelliteMapSource,
  createTerrainMapSource,
  createWorldRuntimeController,
  getMapSourceExperience,
  isMapLibreRendererAdapter,
  MAPLIBRE_DEFAULT_CAMERA,
  OPENFREEMAP_VECTOR_TILES_URL,
  resolveBuildingsVisibility,
  resolveEffectiveBuildingsMode,
  resolveRoadClassVisibility,
  STREET_MAP_SOURCE_ID,
  SATELLITE_MAP_SOURCE_ID,
  TERRAIN_MAP_SOURCE_ID,
} from "@/src/lib/world";

describe("roads & buildings policy", () => {
  it("hides local roads at far zoom for medium detail", () => {
    const far = resolveRoadClassVisibility("medium", 4);
    expect(far.highway).toBe(true);
    expect(far.primary).toBe(false);
    expect(far.secondary).toBe(false);
    expect(far.local).toBe(false);
    expect(far.roadLabels).toBe(false);
  });

  it("reveals classes by zoom for high detail", () => {
    const near = resolveRoadClassVisibility("high", 12);
    expect(near.highway).toBe(true);
    expect(near.primary).toBe(true);
    expect(near.secondary).toBe(true);
    expect(near.local).toBe(true);
    expect(near.roadLabels).toBe(true);
  });

  it("gates 3D buildings to 2D fallback", () => {
    expect(
      resolveEffectiveBuildingsMode({
        preference: "3d",
        rendererSupportsBuildings: true,
        rendererSupports3D: false,
        sourceSupports2d: true,
        sourceSupports3d: true,
      })
    ).toBe("2d");

    expect(
      resolveBuildingsVisibility({
        preference: "3d",
        zoom: 16,
        rendererSupportsBuildings: true,
        rendererSupports3D: false,
        sourceSupports2d: true,
        sourceSupports3d: true,
      })
    ).toEqual({ fill2d: true, extrusion3d: false });
  });

  it("fails closed when buildings unsupported", () => {
    expect(
      resolveEffectiveBuildingsMode({
        preference: "2d",
        rendererSupportsBuildings: false,
        rendererSupports3D: true,
        sourceSupports2d: true,
        sourceSupports3d: true,
      })
    ).toBe("off");
  });
});

describe("map source experience", () => {
  it("streets include basemap roads and overlay tiles", () => {
    const exp = getMapSourceExperience(createStreetMapSource());
    expect(exp.supportsRoadDetail).toBe(true);
    expect(exp.basemapIncludesRoads).toBe(true);
    expect(exp.getVectorOverlay()?.tiles[0]).toBe(OPENFREEMAP_VECTOR_TILES_URL);
  });

  it("satellite and terrain expose road overlays without basemap roads", () => {
    const sat = getMapSourceExperience(createSatelliteMapSource());
    const ter = getMapSourceExperience(createTerrainMapSource());
    expect(sat.basemapIncludesRoads).toBe(false);
    expect(ter.basemapIncludesRoads).toBe(false);
    expect(sat.supportsRoadDetail).toBe(true);
    expect(ter.supportsBuildings3d).toBe(false);
  });
});

describe("MapLibre roads/buildings adapter", () => {
  it("reports buildings capability", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    });
    expect(adapter.getCapabilities().supportsBuildings).toBe(true);
    expect(createNullRendererAdapter().getCapabilities().supportsBuildings).toBe(
      false
    );
  });

  it("accepts road detail and buildings prefs without resetting camera", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: "https://tiles.openfreemap.org/styles/liberty",
      initialCamera: { ...MAPLIBRE_DEFAULT_CAMERA, zoom: 9, latitude: 25 },
    });
    adapter.mount();
    const before = adapter.getSessionCamera();
    expect(adapter.setRoadDetail("high")).toBe(true);
    expect(adapter.setBuildingsMode("3d")).toBe(true);
    expect(adapter.getRoadDetail()).toBe("high");
    expect(adapter.getBuildingsMode()).toBe("3d");
    expect(adapter.getSessionCamera()).toEqual(before);
  });

  it("stores overlay from MapSource injection", () => {
    const adapter = createMapLibreRendererAdapter({
      styleUrl: "https://example.com/style.json",
    });
    adapter.setVectorOverlay({
      tiles: [OPENFREEMAP_VECTOR_TILES_URL],
      attribution: "test",
    });
    expect(adapter.getVectorOverlay()?.tiles).toEqual([
      OPENFREEMAP_VECTOR_TILES_URL,
    ]);
    adapter.setVectorOverlay(null);
    expect(adapter.getVectorOverlay()).toBeNull();
  });
});

describe("experience controls", () => {
  it("disables road detail when source unsupported", () => {
    const controls = buildWorldRoadDetailControls(false, "medium");
    expect(controls.every((c) => c.enabled === false)).toBe(true);
  });

  it("disables 3D when source lacks buildings3d", () => {
    const controls = buildWorldBuildingsControls(
      {
        supportsBuildings: true,
        supports3D: true,
        sourceSupports2d: true,
        sourceSupports3d: false,
      },
      "3d",
      "2d"
    );
    const threeD = controls.find((c) => c.id === "3d");
    expect(threeD?.enabled).toBe(false);
  });
});

describe("runtime roads & buildings", () => {
  it("changes road detail without reinit and preserves camera/layers/source", async () => {
    const controller = createWorldRuntimeController({
      mapSourceId: STREET_MAP_SOURCE_ID,
      yieldMs: 0,
    });
    await controller.start();
    const attempt = controller.getRuntimeState().attempt;
    const renderer = controller.getRendererAdapter();
    if (!isMapLibreRendererAdapter(renderer)) {
      throw new Error("expected maplibre");
    }
    renderer.mount();
    renderer.reportStyleLoaded();
    renderer.getCameraAdapter().setCamera({
      ...MAPLIBRE_DEFAULT_CAMERA,
      zoom: 8,
      latitude: 33.5,
      longitude: 36.3,
    });
    // Preserve whatever layer visibility already exists after start.
    if (!renderer.getLayerAdapter().isLayerVisible("users")) {
      controller.toggleLayer("users", true);
    }
    const cam = renderer.getSessionCamera();
    const sourceId = controller.getSelectedMapSource()?.id;
    const usersVisible = renderer.getLayerAdapter().isLayerVisible("users");

    expect(controller.setRoadDetail("high")).toBe(true);
    expect(controller.getRoadDetail()).toBe("high");
    expect(controller.getRuntimeState().attempt).toBe(attempt);
    expect(renderer.getSessionCamera()).toEqual(cam);
    expect(controller.getSelectedMapSource()?.id).toBe(sourceId);
    expect(renderer.getLayerAdapter().isLayerVisible("users")).toBe(
      usersVisible
    );
  });

  it("manual buildings toggle with 3d→2d fail-closed on terrain", async () => {
    const controller = createWorldRuntimeController({
      mapSourceId: TERRAIN_MAP_SOURCE_ID,
      yieldMs: 0,
    });
    await controller.start();
    const attempt = controller.getRuntimeState().attempt;
    expect(controller.setBuildingsMode("3d")).toBe(true);
    expect(controller.getBuildingsMode()).toBe("3d");
    expect(controller.getEffectiveBuildingsMode()).toBe("2d");
    expect(controller.getRuntimeState().attempt).toBe(attempt);
  });

  it("preserves map source across preference changes", async () => {
    const controller = createWorldRuntimeController({
      mapSourceId: SATELLITE_MAP_SOURCE_ID,
      yieldMs: 0,
    });
    await controller.start();
    expect(controller.getSelectedMapSource()?.id).toBe(SATELLITE_MAP_SOURCE_ID);
    controller.setRoadDetail("low");
    controller.setBuildingsMode("off");
    expect(controller.getSelectedMapSource()?.id).toBe(SATELLITE_MAP_SOURCE_ID);
    const view = controller.getViewState();
    expect(view.roadDetailControls.some((c) => c.enabled)).toBe(true);
    expect(view.buildingsControls.find((c) => c.id === "off")?.enabled).toBe(
      true
    );
  });

  it("does not wipe category layers when applying map experience", async () => {
    const controller = createWorldRuntimeController({
      mapSourceId: STREET_MAP_SOURCE_ID,
      yieldMs: 0,
    });
    await controller.start();
    const renderer = controller.getRendererAdapter();
    if (!isMapLibreRendererAdapter(renderer)) {
      throw new Error("expected maplibre");
    }
    // Ensure users layer is selected (toggle is idempotent only when off).
    if (!renderer.getLayerAdapter().isLayerVisible("users")) {
      controller.toggleLayer("users", true);
    }
    if (!renderer.getLayerAdapter().isLayerVisible("games")) {
      controller.toggleLayer("games", true);
    }
    expect(renderer.getLayerAdapter().isLayerVisible("users")).toBe(true);
    expect(renderer.getLayerAdapter().isLayerVisible("games")).toBe(true);
    controller.setRoadDetail("medium");
    controller.setBuildingsMode("2d");
    expect(renderer.getLayerAdapter().isLayerVisible("users")).toBe(true);
    expect(renderer.getLayerAdapter().isLayerVisible("games")).toBe(true);
  });
});
