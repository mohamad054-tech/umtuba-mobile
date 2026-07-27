import { describe, expect, it } from "vitest";

import {
  buildWorldCommerceSheetState,
  createCommerceRegistry,
  createDemoCommerceDataProvider,
  createDemoGamesDataProvider,
  createDemoPlacesDataProvider,
  createUnboundCommerceDataProvider,
  createWorldDataPipeline,
  createWorldRuntimeController,
  isCommerceClusteringActiveAtZoom,
  isMapLibreRendererAdapter,
  normalizeWorldCommerceRecord,
  WORLD_COMMERCE_LAYER_ID,
} from "@/src/lib/world";

describe("WorldCommerceProvider", () => {
  it("demo provider returns typed commerce nodes", async () => {
    const provider = createDemoCommerceDataProvider();
    expect(provider.kind).toBe("commerce");
    expect(provider.isAvailable()).toBe(true);
    const rows = await provider.listCommerce();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.commerceType).sort()).toEqual([
      "market",
      "restaurant",
      "seller_hub",
      "service",
      "store",
      "store",
    ]);

    const registry = createCommerceRegistry();
    expect(registry.registerAll(rows)).toBe(5);
    expect(registry.listMappable().length).toBe(5);
  });

  it("rejects invalid, unpublished, hidden, and PII-shaped rows", () => {
    expect(
      normalizeWorldCommerceRecord({
        id: "",
        name: "X",
        commerceType: "store",
        cityName: "Amman",
        brandName: null,
        latitude: 1,
        longitude: 1,
        mapVisible: true,
        published: true,
      })
    ).toBeNull();
    expect(
      normalizeWorldCommerceRecord({
        id: "c1",
        name: "X",
        commerceType: "unknown" as "store",
        cityName: "Amman",
        brandName: null,
        latitude: 1,
        longitude: 1,
        mapVisible: true,
        published: true,
      })
    ).toBeNull();
    expect(
      normalizeWorldCommerceRecord({
        id: "c2",
        name: "Hidden",
        commerceType: "store",
        cityName: "Amman",
        brandName: null,
        latitude: 1,
        longitude: 1,
        mapVisible: false,
        published: true,
      })
    ).toBeNull();
    expect(
      normalizeWorldCommerceRecord({
        id: "c3",
        name: "Draft",
        commerceType: "store",
        cityName: "Amman",
        brandName: null,
        latitude: 1,
        longitude: 1,
        mapVisible: true,
        published: false,
      })
    ).toBeNull();
    expect(
      normalizeWorldCommerceRecord({
        id: "c4",
        name: "Bad Brand",
        commerceType: "store",
        cityName: "Amman",
        brandName: "sales@shop.com",
        latitude: 1,
        longitude: 1,
        mapVisible: true,
        published: true,
      })
    ).toBeNull();
  });

  it("unbound commerce provider is fail-closed", async () => {
    const provider = createUnboundCommerceDataProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listCommerce()).toEqual([]);
  });
});

describe("Commerce clustering helper", () => {
  it("clusters at far zoom and separates when closer", () => {
    expect(isCommerceClusteringActiveAtZoom(3)).toBe(true);
    expect(isCommerceClusteringActiveAtZoom(5.7)).toBe(true);
    expect(isCommerceClusteringActiveAtZoom(7)).toBe(false);
  });
});

describe("Runtime commerce layer", () => {
  it("toggles commerce independently and opens commerce sheet", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getCommerceRegistry().size()).toBe(5);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.getGamesRegistry().size()).toBeGreaterThan(0);
    expect(controller.getUsersRegistry().size()).toBeGreaterThan(0);

    const first = controller.getCommerceRegistry().listMappable()[0];
    expect(first).toBeTruthy();
    expect(controller.selectCommerce(first.id)).toBe(true);
    const sheet = controller.getViewState().commerceSheet;
    expect(sheet?.name).toBe(first.name);
    expect(sheet?.cityName).toBe(first.cityName);
    expect(sheet?.meta).toEqual([]);
    expect(sheet?.actions).toEqual([]);
    expect(controller.getViewState().placeSheet).toBeNull();
    expect(controller.getViewState().gameSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    const placesBefore = renderer.getPlaceMarkers().length;
    const gamesBefore = renderer.getGameMarkers().length;
    expect(renderer.getCommerceMarkers().length).toBeGreaterThan(0);

    controller.toggleLayer(WORLD_COMMERCE_LAYER_ID, true);
    expect(controller.getSelection().selectedCategories.includes("businesses")).toBe(false);
    expect(renderer.getCommerceMarkers()).toEqual([]);
    expect(renderer.getPlaceMarkers().length).toBe(placesBefore);
    expect(renderer.getGameMarkers().length).toBe(gamesBefore);

    controller.toggleLayer(WORLD_COMMERCE_LAYER_ID, true);
    expect(renderer.getCommerceMarkers().length).toBeGreaterThan(0);

    const sheetState = buildWorldCommerceSheetState(first, true);
    expect(sheetState?.actions).toEqual([]);
    expect(sheetState?.meta).toEqual([]);
  });

  it("fail-closes commerce when provider missing without breaking places", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [createDemoPlacesDataProvider(), createDemoGamesDataProvider()],
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    expect(controller.getCommerceRegistry().size()).toBe(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.selectCommerce("commerce-store-amman")).toBe(false);
  });

  it("search finds commerce by name, type, city, and brand", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(
      controller.searchWorld("Rainbow Market").some((h) => h.sourceType === "commerce")
    ).toBe(true);
    expect(
      controller
        .searchWorld("restaurant")
        .some((h) => h.id === "commerce-restaurant-cairo")
    ).toBe(true);
    expect(
      controller
        .searchWorld("Marina Tech")
        .some((h) => h.sourceType === "commerce")
    ).toBe(true);

    const hit = controller
      .searchWorld("Amman Seller Hub")
      .find((h) => h.sourceType === "commerce");
    expect(hit).toBeTruthy();
    expect(controller.selectSearchResult(hit!)).toBe(true);
    expect(controller.getViewState().commerceSheet?.name).toBe("Amman Seller Hub");
  });
});
