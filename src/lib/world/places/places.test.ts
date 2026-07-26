import { describe, expect, it } from "vitest";

import {
  createDemoPlaceProvider,
  createPlaceRegistry,
  createUnboundPlaceProvider,
  createWorldRuntimeController,
  DEMO_PLACE_PROVIDER_ID,
  formatWorldPlaceKindLabel,
  isMapLibreRendererAdapter,
  listDemoPlaces,
  parseWorldPlace,
  WORLD_PLACES_LAYER_ID,
} from "@/src/lib/world";

describe("Place Registry", () => {
  it("registers Country / State / City / Capital and rejects invalid", () => {
    const registry = createPlaceRegistry();
    expect(
      registry.register({
        id: "c1",
        kind: "country",
        name: "Jordan",
        countryName: "Jordan",
        countryCode: "JO",
        stateName: null,
        latitude: 31.0,
        longitude: 36.0,
      })
    ).toBe(true);
    expect(
      registry.register({
        id: "s1",
        kind: "state",
        name: "Amman Governorate",
        countryName: "Jordan",
        countryCode: "JO",
        stateName: "Amman",
        latitude: 31.95,
        longitude: 35.91,
      })
    ).toBe(true);
    expect(
      registry.register({
        id: "city-1",
        kind: "city",
        name: "Zarqa",
        countryName: "Jordan",
        countryCode: "JO",
        stateName: null,
        latitude: 32.07,
        longitude: 36.09,
      })
    ).toBe(true);
    expect(
      registry.register({
        id: "cap-1",
        kind: "capital",
        name: "Amman",
        countryName: "Jordan",
        countryCode: "JO",
        stateName: null,
        latitude: 31.95,
        longitude: 35.91,
      })
    ).toBe(true);
    expect(registry.size()).toBe(4);
    expect(registry.listByKind("capital")).toHaveLength(1);
    expect(registry.listCities()).toHaveLength(2);
    expect(registry.register({ id: "bad" } as never)).toBe(false);
    expect(parseWorldPlace({ id: "x", kind: "moon", name: "X" })).toBeNull();
  });
});

describe("Demo Place Provider", () => {
  it("exposes the development city set", async () => {
    const provider = createDemoPlaceProvider();
    expect(provider.id).toBe(DEMO_PLACE_PROVIDER_ID);
    expect(provider.isAvailable()).toBe(true);
    const places = await provider.listPlaces();
    expect(places.length).toBe(8);
    const names = places.map((p) => p.name).sort();
    expect(names).toEqual(
      [
        "Amman",
        "Cairo",
        "Dubai",
        "Jerusalem",
        "London",
        "New York",
        "Riyadh",
        "Tokyo",
      ].sort()
    );
    expect(listDemoPlaces()).toHaveLength(8);
    expect(formatWorldPlaceKindLabel("capital")).toBe("Capital");
    expect(formatWorldPlaceKindLabel("city")).toBe("City");
  });

  it("unbound provider is fail-closed", async () => {
    const provider = createUnboundPlaceProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listPlaces()).toEqual([]);
  });
});

describe("Runtime places layer toggle + marker selection", () => {
  it("loads demo places, toggles Cities layer, selects a marker", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getRuntimeState().placeProviderBound).toBe(true);
    expect(controller.getPlaceRegistry().listCities().length).toBe(8);
    expect(
      controller.getSelection().selectedCategories.includes(WORLD_PLACES_LAYER_ID)
    ).toBe(true);

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    expect(renderer.getPlaceMarkers().length).toBe(8);
    expect(
      renderer.getLayerAdapter().isLayerVisible(WORLD_PLACES_LAYER_ID)
    ).toBe(true);

    // Toggle cities off (enabled=true means allow toggle membership)
    controller.toggleLayer("cities", true);
    expect(
      controller.getSelection().selectedCategories.includes("cities")
    ).toBe(false);
    expect(renderer.getPlaceMarkers()).toEqual([]);
    expect(
      renderer.getLayerAdapter().isLayerVisible(WORLD_PLACES_LAYER_ID)
    ).toBe(false);

    // Toggle cities on again
    controller.toggleLayer("cities", true);
    expect(renderer.getPlaceMarkers().length).toBe(8);

    const amman = controller.getPlaceRegistry().get("place-amman");
    expect(amman?.name).toBe("Amman");
    expect(controller.selectPlace("place-amman")).toBe(true);
    const view = controller.getViewState();
    expect(view.selectedEntityId).toBe("place-amman");
    expect(view.detailsOpen).toBe(true);
    const entity = view.entities.find((e) => e.id === "place-amman");
    expect(entity?.title).toBe("Amman");
    expect(entity?.subtitle).toMatch(/Jordan/);
    expect(entity?.subtitle).toMatch(/Capital/);

    renderer.reportPlacePress("place-dubai");
    expect(controller.getViewState().selectedEntityId).toBe("place-dubai");
    expect(renderer.getSelectedPlaceMarkerId()).toBe("place-dubai");

    controller.closeDetails();
    expect(controller.getViewState().detailsOpen).toBe(false);
    expect(renderer.getSelectedPlaceMarkerId()).toBeNull();
  });

  it("missing place provider → no markers, no crash", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      placeProvider: null,
    });
    await controller.start();
    expect(controller.getRuntimeState().placeProviderBound).toBe(false);
    expect(controller.getPlaceRegistry().size()).toBe(0);
    expect(controller.getViewState().entities).toEqual([]);
    expect(controller.selectPlace("place-amman")).toBe(false);

    const renderer = controller.getRendererAdapter();
    if (isMapLibreRendererAdapter(renderer)) {
      expect(renderer.getPlaceMarkers()).toEqual([]);
    }
  });
});
