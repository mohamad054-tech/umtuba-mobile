import { describe, expect, it } from "vitest";

import {
  buildWorldGameSheetState,
  createDemoGamesDataProvider,
  createDemoPlacesDataProvider,
  createGamesRegistry,
  createUnboundGamesDataProvider,
  createWorldDataPipeline,
  createWorldRuntimeController,
  isGameClusteringActiveAtZoom,
  isMapLibreRendererAdapter,
  normalizeWorldGameRecord,
  WORLD_GAMES_LAYER_ID,
} from "@/src/lib/world";

describe("WorldGamesProvider", () => {
  it("demo provider returns typed game nodes", async () => {
    const provider = createDemoGamesDataProvider();
    expect(provider.kind).toBe("games");
    expect(provider.isAvailable()).toBe(true);
    const rows = await provider.listGames();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.category).sort()).toEqual([
      "casual_game",
      "game_hub",
      "multiplayer_game",
      "tournament",
    ]);

    const registry = createGamesRegistry();
    expect(registry.registerAll(rows)).toBe(rows.length);
    expect(registry.listMappable().length).toBe(rows.length);
  });

  it("rejects invalid rows", () => {
    expect(
      normalizeWorldGameRecord({
        id: "",
        gameName: "X",
        category: "casual_game",
        cityName: "Amman",
        latitude: 1,
        longitude: 1,
      })
    ).toBeNull();
    expect(
      normalizeWorldGameRecord({
        id: "g1",
        gameName: "X",
        category: "unknown" as "casual_game",
        cityName: "Amman",
        latitude: 1,
        longitude: 1,
      })
    ).toBeNull();
  });

  it("unbound games provider is fail-closed", async () => {
    const provider = createUnboundGamesDataProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listGames()).toEqual([]);
  });
});

describe("Game clustering helper", () => {
  it("clusters at far zoom and separates when closer", () => {
    expect(isGameClusteringActiveAtZoom(3)).toBe(true);
    expect(isGameClusteringActiveAtZoom(5.8)).toBe(true);
    expect(isGameClusteringActiveAtZoom(7)).toBe(false);
  });
});

describe("Runtime games layer", () => {
  it("toggles games independently and opens game sheet", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getGamesRegistry().size()).toBeGreaterThan(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.getEducationRegistry().size()).toBeGreaterThan(0);
    expect(controller.getUsersRegistry().size()).toBeGreaterThan(0);

    const first = controller.getGamesRegistry().listMappable()[0];
    expect(first).toBeTruthy();
    expect(controller.selectGame(first.id)).toBe(true);
    const sheet = controller.getViewState().gameSheet;
    expect(sheet?.gameName).toBe(first.gameName);
    expect(sheet?.cityName).toBe(first.cityName);
    expect(sheet?.meta).toEqual([]);
    expect(sheet?.actions).toEqual([]);
    expect(controller.getViewState().placeSheet).toBeNull();
    expect(controller.getViewState().educationSheet).toBeNull();
    expect(controller.getViewState().userSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    const placesBefore = renderer.getPlaceMarkers().length;
    const educationBefore = renderer.getEducationMarkers().length;
    const usersBefore = renderer.getUserMarkers().length;
    expect(renderer.getGameMarkers().length).toBeGreaterThan(0);

    controller.toggleLayer(WORLD_GAMES_LAYER_ID, true);
    expect(controller.getSelection().selectedCategories.includes("games")).toBe(false);
    expect(renderer.getGameMarkers()).toEqual([]);
    expect(renderer.getPlaceMarkers().length).toBe(placesBefore);
    expect(renderer.getEducationMarkers().length).toBe(educationBefore);
    expect(renderer.getUserMarkers().length).toBe(usersBefore);

    controller.toggleLayer(WORLD_GAMES_LAYER_ID, true);
    expect(renderer.getGameMarkers().length).toBeGreaterThan(0);

    const sheetState = buildWorldGameSheetState(first, true);
    expect(sheetState?.actions).toEqual([]);
    expect(sheetState?.meta).toEqual([]);
  });

  it("fail-closes games when provider missing without breaking places", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [createDemoPlacesDataProvider()],
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    expect(controller.getGamesRegistry().size()).toBe(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.selectGame("game-casual-amman")).toBe(false);
  });

  it("search finds games by name and category", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(
      controller.searchWorld("Night Runner").some((h) => h.sourceType === "games")
    ).toBe(true);
    expect(
      controller
        .searchWorld("tournament")
        .some((h) => h.id === "game-tourney-riyadh")
    ).toBe(true);

    const hit = controller
      .searchWorld("DXB Game Hub")
      .find((h) => h.sourceType === "games");
    expect(hit).toBeTruthy();
    expect(controller.selectSearchResult(hit!)).toBe(true);
    expect(controller.getViewState().gameSheet?.gameName).toBe("DXB Game Hub");
  });
});
