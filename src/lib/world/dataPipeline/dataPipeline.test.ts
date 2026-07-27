import { describe, expect, it } from "vitest";

import {
  adaptPlaceProvider,
  createDefaultWorldDataPipeline,
  createDemoPlacesDataProvider,
  createDemoUsersDataProvider,
  createEmptyWorldDataPipeline,
  createUnboundPlacesDataProvider,
  createWorldDataPipeline,
  createWorldDataRegistry,
  createWorldRuntimeController,
  resolvePlacesProvider,
  resolveUsersProvider,
  WORLD_DATA_KINDS,
} from "@/src/lib/world";
import { createDemoPlaceProvider } from "@/src/lib/world/places";

describe("WorldDataRegistry", () => {
  it("registers one provider per kind and lists available", () => {
    const registry = createWorldDataRegistry();
    expect(registry.register(createDemoPlacesDataProvider())).toBe(true);
    expect(registry.register(createDemoUsersDataProvider())).toBe(true);
    expect(registry.has("places")).toBe(true);
    expect(registry.has("users")).toBe(true);
    expect(registry.has("events")).toBe(false);
    expect(registry.listAvailable().map((p) => p.kind).sort()).toEqual([
      "places",
      "users",
    ]);
  });

  it("rejects invalid providers without crashing", () => {
    const registry = createWorldDataRegistry();
    expect(
      registry.register({
        id: "",
        kind: "places",
        isAvailable: () => true,
        listPlaces: async () => [],
      })
    ).toBe(false);
    expect(registry.has("places")).toBe(false);
  });
});

describe("WorldDataPipeline provider resolution", () => {
  it("resolves demo places, users, and education with empty sibling kinds", async () => {
    const pipeline = createDefaultWorldDataPipeline();
    for (const kind of WORLD_DATA_KINDS) {
      expect(pipeline.hasProvider(kind)).toBe(true);
      expect(pipeline.isKindAvailable(kind)).toBe(true);
    }
    const places = await pipeline.loadPlaces();
    expect(places.length).toBeGreaterThan(0);
    expect((await pipeline.loadUsers()).length).toBeGreaterThan(0);
    expect((await pipeline.loadEducation()).length).toBeGreaterThan(0);
    expect((await pipeline.loadGames()).length).toBeGreaterThan(0);
    expect((await pipeline.loadCommerce()).length).toBeGreaterThan(0);
    expect(await pipeline.loadEvents()).toEqual([]);
    const bundle = await pipeline.loadAll();
    expect(bundle.places.length).toBe(places.length);
    expect(bundle.users.length).toBeGreaterThan(0);
    expect(bundle.games.length).toBeGreaterThan(0);
    expect(bundle.commerce.length).toBeGreaterThan(0);
  });

  it("adapts Places foundation provider into the pipeline", async () => {
    const adapted = adaptPlaceProvider(createDemoPlaceProvider());
    const pipeline = createWorldDataPipeline({ providers: [adapted] });
    expect(resolvePlacesProvider(pipeline.getRegistry())?.id).toBe(
      createDemoPlaceProvider().id
    );
    expect((await pipeline.loadPlaces()).length).toBeGreaterThan(0);
  });
});

describe("WorldDataPipeline missing provider fail-closed", () => {
  it("returns empty arrays when a kind has no provider", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [createDemoPlacesDataProvider()],
    });
    expect(pipeline.hasProvider("users")).toBe(false);
    expect(pipeline.isKindAvailable("users")).toBe(false);
    expect(resolveUsersProvider(pipeline.getRegistry())).toBeNull();
    expect(await pipeline.loadUsers()).toEqual([]);
    expect(await pipeline.loadEvents()).toEqual([]);
    expect((await pipeline.loadPlaces()).length).toBeGreaterThan(0);
  });

  it("keeps other kinds working when places are unbound", async () => {
    const pipeline = createDefaultWorldDataPipeline({ placeProvider: null });
    expect(pipeline.isKindAvailable("places")).toBe(false);
    expect(await pipeline.loadPlaces()).toEqual([]);
    expect(pipeline.isKindAvailable("users")).toBe(true);
    expect((await pipeline.loadUsers()).length).toBeGreaterThan(0);
  });

  it("survives provider throw without crashing", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [
        {
          id: "places-throw",
          kind: "places",
          isAvailable: () => true,
          listPlaces: async () => {
            throw new Error("boom");
          },
        },
        createDemoUsersDataProvider(),
      ],
    });
    expect(await pipeline.loadPlaces()).toEqual([]);
    expect((await pipeline.loadUsers()).length).toBeGreaterThan(0);
  });

  it("empty pipeline is fully fail-closed", async () => {
    const pipeline = createEmptyWorldDataPipeline();
    for (const kind of WORLD_DATA_KINDS) {
      expect(pipeline.isKindAvailable(kind)).toBe(false);
    }
    const bundle = await pipeline.loadAll();
    expect(bundle).toEqual({
      places: [],
      users: [],
      education: [],
      games: [],
      commerce: [],
      events: [],
    });
  });
});

describe("Runtime integration via WorldDataPipeline", () => {
  it("loads places, users, education, games, and commerce through the pipeline and keeps events empty", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(controller.getRuntimeState().placeProviderBound).toBe(true);
    expect(controller.getDataPipeline().isKindAvailable("places")).toBe(true);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    const bundle = controller.getLastDataBundle();
    expect(bundle).not.toBeNull();
    expect(bundle!.places.length).toBeGreaterThan(0);
    expect(bundle!.users.length).toBeGreaterThan(0);
    expect(bundle!.education.length).toBeGreaterThan(0);
    expect(bundle!.games.length).toBeGreaterThan(0);
    expect(bundle!.commerce.length).toBeGreaterThan(0);
    expect(bundle!.events).toEqual([]);
  });

  it("fail-closes places when placeProvider is null without breaking runtime", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      placeProvider: null,
    });
    await controller.start();
    expect(controller.getRuntimeState().placeProviderBound).toBe(false);
    expect(controller.getPlaceRegistry().size()).toBe(0);
    expect(controller.getDataPipeline().isKindAvailable("users")).toBe(true);
    expect(controller.getLastDataBundle()?.users.length).toBeGreaterThan(0);
  });

  it("accepts an explicit empty dataPipeline", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: createEmptyWorldDataPipeline(),
    });
    await controller.start();
    expect(controller.getRuntimeState().placeProviderBound).toBe(false);
    expect(controller.getPlaceRegistry().size()).toBe(0);
    expect(controller.getLastDataBundle()?.places).toEqual([]);
  });

  it("does not expose data-provider ids through view-state JSON surface", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    const json = JSON.stringify(controller.getViewState());
    expect(json).not.toMatch(/world-data-provider/);
    expect(json).not.toMatch(/listPlaces|listUsers|WorldDataPipeline/);
  });
});

describe("createUnboundPlacesDataProvider", () => {
  it("is unavailable and lists nothing", async () => {
    const provider = createUnboundPlacesDataProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listPlaces()).toEqual([]);
  });
});
