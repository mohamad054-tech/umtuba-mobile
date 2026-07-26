import { describe, expect, it } from "vitest";

import {
  createDefaultMapSourceRegistry,
  createDemoMapSource,
  createMapSourceRegistry,
  createSatelliteMapSource,
  createStreetMapSource,
  createTerrainMapSource,
  DEMO_MAP_SOURCE_ID,
  DEMO_MAP_STYLE_URL,
  isWorldMapSourceAvailable,
  STREET_MAP_SOURCE_ID,
} from "@/src/lib/world/mapSource";
import {
  createMockWorldDataSource,
  createWorldRuntimeController,
  isMapLibreRendererAdapter,
  MAPLIBRE_RENDERER_ID,
} from "@/src/lib/world";
import { defaultWorldPermissions, emptyWorldFilter } from "@/src/lib/world/actions";
import { createDisabledWorldRendererAdapter } from "@/src/lib/world/adapter";
import { listWorldCategories } from "@/src/lib/world/categories";
import type { WorldFoundationSnapshot } from "@/src/lib/world/types";

function readySnapshot(): WorldFoundationSnapshot {
  return {
    status: "ready",
    message: "World data ready (mock).",
    categories: listWorldCategories({ includeUnsupported: true }).map(
      (c) => c.id
    ),
    layers: [],
    permissions: defaultWorldPermissions(),
    camera: null,
    filter: emptyWorldFilter(),
    renderer: createDisabledWorldRendererAdapter().capability,
  };
}

describe("DemoMapSource", () => {
  it("owns demotiles URL and is available", () => {
    const source = createDemoMapSource();
    expect(source.id).toBe(DEMO_MAP_SOURCE_ID);
    expect(source.kind).toBe("demo");
    expect(source.isAvailable()).toBe(true);
    expect(source.getStyleUrl()).toBe(DEMO_MAP_STYLE_URL);
    expect(source.getStyleUrl()).toBe(
      "https://demotiles.maplibre.org/style.json"
    );
    expect(isWorldMapSourceAvailable(source)).toBe(true);
  });
});

describe("placeholder map sources", () => {
  it("Street / Satellite / Terrain are unavailable fail-closed", () => {
    for (const source of [
      createStreetMapSource(),
      createSatelliteMapSource(),
      createTerrainMapSource(),
    ]) {
      expect(source.isAvailable()).toBe(false);
      expect(source.getStyleUrl()).toBeNull();
      expect(isWorldMapSourceAvailable(source)).toBe(false);
    }
  });
});

describe("MapSourceRegistry", () => {
  it("lists defaults and resolves Demo as active", () => {
    const registry = createDefaultMapSourceRegistry();
    expect(registry.list()).toHaveLength(4);
    expect(registry.listAvailable()).toHaveLength(1);
    const resolved = registry.resolve();
    expect(resolved?.id).toBe(DEMO_MAP_SOURCE_ID);
    expect(resolved?.getStyleUrl()).toBe(DEMO_MAP_STYLE_URL);
  });

  it("preferred unavailable id falls back to first available", () => {
    const registry = createDefaultMapSourceRegistry();
    const resolved = registry.resolve(STREET_MAP_SOURCE_ID);
    expect(resolved?.id).toBe(DEMO_MAP_SOURCE_ID);
  });

  it("missing source registry resolves null (fail-closed)", () => {
    const registry = createMapSourceRegistry([]);
    expect(registry.resolve()).toBeNull();
    expect(registry.resolve("world-map-source-demo")).toBeNull();
    expect(registry.get("missing")).toBeNull();
  });
});

describe("Runtime map source selection", () => {
  it("selects Demo from default registry and binds MapLibre style", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    expect(controller.getSelectedMapSource()?.id).toBe(DEMO_MAP_SOURCE_ID);
    expect(controller.getRuntimeState().mapSourceBound).toBe(true);
    expect(controller.getRendererAdapter().id).toBe(MAPLIBRE_RENDERER_ID);

    await controller.start();
    expect(controller.getRuntimeState().mapSourceBound).toBe(true);
    expect(controller.getRendererAdapter().isBound()).toBe(true);
    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (isMapLibreRendererAdapter(renderer)) {
      expect(renderer.getStyleUrl()).toBe(DEMO_MAP_STYLE_URL);
    }
  });

  it("missing map source → unavailable without crash", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      mapSourceRegistry: createMapSourceRegistry([]),
      dataSource: createMockWorldDataSource({
        snapshot: readySnapshot(),
        available: true,
      }),
    });
    expect(controller.getSelectedMapSource()).toBeNull();
    expect(controller.getRuntimeState().mapSourceBound).toBe(false);
    expect(controller.getRendererAdapter().isBound()).toBe(false);

    await controller.start();
    expect(controller.getRuntimeState().phase).toBe("unavailable");
    expect(controller.getViewState().phase).toBe("unavailable");
    expect(controller.getViewState().message).toMatch(/map source/i);
  });
});
