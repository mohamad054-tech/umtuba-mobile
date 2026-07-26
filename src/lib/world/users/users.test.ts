import { describe, expect, it } from "vitest";

import {
  buildWorldUserSheetState,
  createDemoPlacesDataProvider,
  createDemoUsersDataProvider,
  createUnboundUsersDataProvider,
  createUsersRegistry,
  createWorldDataPipeline,
  createWorldRuntimeController,
  isMapLibreRendererAdapter,
  isUserClusteringActiveAtZoom,
  normalizeWorldUserRecord,
  WORLD_USERS_LAYER_ID,
} from "@/src/lib/world";

describe("WorldUsersProvider + privacy", () => {
  it("demo provider returns visible users without PII and filters hidden", async () => {
    const provider = createDemoUsersDataProvider();
    expect(provider.kind).toBe("users");
    expect(provider.isAvailable()).toBe(true);
    const rows = await provider.listUsers();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.mapVisible === false)).toBe(true);

    const registry = createUsersRegistry();
    const accepted = registry.registerAll(rows);
    expect(accepted).toBeLessThan(rows.length);
    expect(registry.list().every((r) => r.mapVisible === true)).toBe(true);
    expect(registry.get("user-demo-hidden")).toBeNull();

    for (const row of registry.list()) {
      expect(row.displayName.includes("@")).toBe(false);
      expect(row.handle.includes("@")).toBe(false);
      expect(typeof row.approximateLatitude).toBe("number");
      expect(typeof row.approximateLongitude).toBe("number");
      const json = JSON.stringify(row);
      expect(json.toLowerCase()).not.toMatch(/email|phone|password/);
    }
  });

  it("rejects invalid or private rows", () => {
    expect(
      normalizeWorldUserRecord({
        id: "x",
        displayName: "A",
        handle: "a",
        cityName: "Amman",
        approximateLatitude: 31.9,
        approximateLongitude: 35.9,
        mapVisible: false,
        presence: null,
      })
    ).toBeNull();
    expect(
      normalizeWorldUserRecord({
        id: "x",
        displayName: "A",
        handle: "name@mail.com",
        cityName: "Amman",
        approximateLatitude: 31.9,
        approximateLongitude: 35.9,
        mapVisible: true,
        presence: null,
      })
    ).toBeNull();
  });

  it("unbound users provider is fail-closed", async () => {
    const provider = createUnboundUsersDataProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listUsers()).toEqual([]);
  });
});

describe("User clustering helper", () => {
  it("clusters at far zoom and separates when closer", () => {
    expect(isUserClusteringActiveAtZoom(3)).toBe(true);
    expect(isUserClusteringActiveAtZoom(5.5)).toBe(true);
    expect(isUserClusteringActiveAtZoom(6.5)).toBe(false);
  });
});

describe("Runtime users layer", () => {
  it("toggles users independently and opens user sheet", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getUsersRegistry().size()).toBeGreaterThan(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.getEducationRegistry().size()).toBeGreaterThan(0);

    const first = controller.getUsersRegistry().listMappable()[0];
    expect(first).toBeTruthy();
    expect(controller.selectUser(first.id)).toBe(true);
    const sheet = controller.getViewState().userSheet;
    expect(sheet?.displayName).toBe(first.displayName);
    expect(sheet?.handle).toBe(first.handle);
    expect(sheet?.cityName).toBe(first.cityName);
    expect(sheet?.actions.every((a) => a.enabled === false)).toBe(true);
    expect(controller.getViewState().placeSheet).toBeNull();
    expect(controller.getViewState().educationSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    const placesBefore = renderer.getPlaceMarkers().length;
    const educationBefore = renderer.getEducationMarkers().length;
    expect(renderer.getUserMarkers().length).toBeGreaterThan(0);

    controller.toggleLayer(WORLD_USERS_LAYER_ID, true);
    expect(
      controller.getSelection().selectedCategories.includes("users")
    ).toBe(false);
    expect(renderer.getUserMarkers()).toEqual([]);
    expect(renderer.getPlaceMarkers().length).toBe(placesBefore);
    expect(renderer.getEducationMarkers().length).toBe(educationBefore);

    controller.toggleLayer(WORLD_USERS_LAYER_ID, true);
    expect(renderer.getUserMarkers().length).toBeGreaterThan(0);

    const sheetState = buildWorldUserSheetState(first, true);
    expect(sheetState?.actions.map((a) => a.id)).toEqual([
      "view_profile",
      "follow",
      "message",
    ]);
  });

  it("fail-closes users when provider missing without breaking places", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [createDemoPlacesDataProvider()],
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    expect(controller.getUsersRegistry().size()).toBe(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.selectUser("user-demo-layla")).toBe(false);
  });

  it("search finds users by display name and handle", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(
      controller.searchWorld("Layla").some((h) => h.sourceType === "users")
    ).toBe(true);
    expect(
      controller.searchWorld("omar_h").some((h) => h.id === "user-demo-omar")
    ).toBe(true);
    expect(
      controller.searchWorld("hidden_user").some((h) => h.id === "user-demo-hidden")
    ).toBe(false);

    const hit = controller.searchWorld("sara.k").find((h) => h.sourceType === "users");
    expect(hit).toBeTruthy();
    expect(controller.selectSearchResult(hit!)).toBe(true);
    expect(controller.getViewState().userSheet?.handle).toBe("sara.k");
  });
});
