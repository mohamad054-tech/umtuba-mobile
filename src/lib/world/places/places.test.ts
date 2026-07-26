import { describe, expect, it } from "vitest";

import {
  buildWorldPlaceSheetState,
  clusterPlacesByZoom,
  createDemoPlaceProvider,
  createPlaceRegistry,
  createUnboundPlaceProvider,
  createWorldRuntimeController,
  DEMO_PLACE_PROVIDER_ID,
  filterMarkersByPlaceLayers,
  isMapLibreRendererAdapter,
  isPlaceClusteringActiveAtZoom,
  isPlaceLabelVisibleAtZoom,
  listDemoPlaces,
  parseWorldPlace,
  PLACE_CLUSTER_MAX_ZOOM,
  PLACE_LABEL_MIN_ZOOM,
  placeMarkerRadiusPx,
  resolvePlaceCityTier,
  WORLD_PLACES_LAYER_ID,
  worldPlacesToMarkers,
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
    expect(registry.register({ id: "bad" } as never)).toBe(false);
    expect(parseWorldPlace({ id: "x", kind: "moon", name: "X" })).toBeNull();
  });
});

describe("Demo Place Provider", () => {
  it("exposes capitals, major, and minor tiers", async () => {
    const provider = createDemoPlaceProvider();
    expect(provider.id).toBe(DEMO_PLACE_PROVIDER_ID);
    const places = await provider.listPlaces();
    expect(places.length).toBe(listDemoPlaces().length);
    expect(places.some((p) => resolvePlaceCityTier(p) === "capital")).toBe(
      true
    );
    expect(places.some((p) => resolvePlaceCityTier(p) === "major")).toBe(true);
    expect(places.some((p) => resolvePlaceCityTier(p) === "minor")).toBe(true);
  });

  it("unbound provider is fail-closed", async () => {
    const provider = createUnboundPlaceProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listPlaces()).toEqual([]);
  });
});

describe("Places UX helpers", () => {
  it("controls label visibility by zoom", () => {
    expect(isPlaceLabelVisibleAtZoom(PLACE_LABEL_MIN_ZOOM - 0.5)).toBe(false);
    expect(isPlaceLabelVisibleAtZoom(PLACE_LABEL_MIN_ZOOM)).toBe(true);
    expect(isPlaceLabelVisibleAtZoom(8)).toBe(true);
  });

  it("clusters at far zoom and separates when closer", () => {
    expect(isPlaceClusteringActiveAtZoom(PLACE_CLUSTER_MAX_ZOOM - 1)).toBe(
      true
    );
    expect(isPlaceClusteringActiveAtZoom(PLACE_CLUSTER_MAX_ZOOM + 1)).toBe(
      false
    );
    const points = [
      { id: "a", latitude: 31.9, longitude: 35.9 },
      { id: "b", latitude: 31.95, longitude: 35.91 },
      { id: "c", latitude: 40.7, longitude: -74 },
    ];
    const far = clusterPlacesByZoom(points, 2);
    expect(far.length).toBeLessThan(points.length);
    const near = clusterPlacesByZoom(points, PLACE_CLUSTER_MAX_ZOOM + 2);
    expect(near).toHaveLength(points.length);
  });

  it("scales marker radius with zoom and selection", () => {
    const base = placeMarkerRadiusPx(3, "capital", false);
    const selected = placeMarkerRadiusPx(3, "capital", true);
    const zoomed = placeMarkerRadiusPx(10, "capital", false);
    expect(selected).toBeGreaterThan(base);
    expect(zoomed).toBeGreaterThan(base);
  });
});

describe("Runtime places UX: layers, selection, bottom sheet", () => {
  it("toggles Capitals/Major/Minor and opens place sheet on selection", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getRuntimeState().placeProviderBound).toBe(true);
    const view0 = controller.getViewState();
    expect(view0.placeLayers.length).toBe(3);
    expect(view0.placeLayers.every((l) => l.enabled)).toBe(true);
    expect(view0.placeSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    const before = renderer.getPlaceMarkers().length;
    expect(before).toBeGreaterThan(0);

    controller.togglePlaceLayer("cities_minor");
    expect(
      controller.getSelection().selectedPlaceLayers.includes("cities_minor")
    ).toBe(false);
    expect(renderer.getPlaceMarkers().length).toBeLessThan(before);

    expect(controller.selectPlace("place-amman")).toBe(true);
    const sheet = controller.getViewState().placeSheet;
    expect(sheet?.open).toBe(true);
    expect(sheet?.name).toBe("Amman");
    expect(sheet?.countryName).toBe("Jordan");
    expect(sheet?.kindLabel).toBe("Capital");
    expect(sheet?.metrics.map((m) => m.id)).toEqual([
      "population",
      "users",
      "education",
      "events",
      "games",
    ]);
    expect(sheet?.metrics.every((m) => m.value == null)).toBe(true);
    expect(renderer.getSelectedPlaceMarkerId()).toBe("place-amman");
    expect(renderer.getSessionCamera().zoom).toBeGreaterThanOrEqual(6);

    renderer.reportPlacePress("place-dubai");
    expect(controller.getViewState().placeSheet?.name).toBe("Dubai");

    controller.closeDetails();
    expect(controller.getViewState().placeSheet).toBeNull();
    expect(renderer.getSelectedPlaceMarkerId()).toBeNull();
  });

  it("filters markers by active place layers", () => {
    const markers = worldPlacesToMarkers(listDemoPlaces());
    const onlyCapitals = filterMarkersByPlaceLayers(markers, [
      "cities_capitals",
    ]);
    expect(onlyCapitals.every((m) => m.cityTier === "capital")).toBe(true);
    expect(onlyCapitals.length).toBeGreaterThan(0);
  });

  it("builds sheet state fail-closed without invented metrics", () => {
    const place = listDemoPlaces().find((p) => p.id === "place-tokyo")!;
    const sheet = buildWorldPlaceSheetState(place, true);
    expect(sheet?.name).toBe("Tokyo");
    expect(sheet?.metrics.every((m) => m.value == null)).toBe(true);
    expect(buildWorldPlaceSheetState(null, true)).toBeNull();
  });

  it("missing place provider → no markers / sheet, no crash", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      placeProvider: null,
    });
    await controller.start();
    expect(controller.getRuntimeState().placeProviderBound).toBe(false);
    expect(controller.getViewState().placeLayers.every((l) => !l.enabled)).toBe(
      true
    );
    expect(controller.getViewState().placeSheet).toBeNull();
    expect(controller.selectPlace("place-amman")).toBe(false);
  });
});

describe("legacy cities toggle still syncs", () => {
  it("keeps WORLD_PLACES_LAYER_ID visibility in layer adapter", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(
      controller.getSelection().selectedCategories.includes(WORLD_PLACES_LAYER_ID)
    ).toBe(true);
    controller.toggleLayer("cities", true);
    expect(
      controller.getSelection().selectedCategories.includes("cities")
    ).toBe(false);
  });
});
