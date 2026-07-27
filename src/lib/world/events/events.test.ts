import { describe, expect, it } from "vitest";

import {
  buildWorldEventSheetState,
  createDemoCommerceDataProvider,
  createDemoEventsDataProvider,
  createDemoGamesDataProvider,
  createDemoPlacesDataProvider,
  createEventsRegistry,
  createUnboundEventsDataProvider,
  createWorldDataPipeline,
  createWorldRuntimeController,
  isEventClusteringActiveAtZoom,
  isMapLibreRendererAdapter,
  normalizeWorldEventRecord,
  WORLD_EVENTS_LAYER_ID,
} from "@/src/lib/world";

describe("WorldEventsProvider", () => {
  it("demo provider returns typed event nodes", async () => {
    const provider = createDemoEventsDataProvider();
    expect(provider.kind).toBe("events");
    expect(provider.isAvailable()).toBe(true);
    const rows = await provider.listEvents();
    expect(rows.length).toBe(6);
    expect(rows.map((r) => r.eventType).sort()).toEqual([
      "conference",
      "festival",
      "live_event",
      "meetup",
      "tournament",
      "workshop",
    ]);

    const registry = createEventsRegistry();
    expect(registry.registerAll(rows)).toBe(6);
    expect(registry.listMappable().length).toBe(6);
  });

  it("rejects invalid rows", () => {
    expect(
      normalizeWorldEventRecord({
        id: "",
        eventName: "X",
        eventType: "conference",
        cityName: "Amman",
        latitude: 1,
        longitude: 1,
      })
    ).toBeNull();
    expect(
      normalizeWorldEventRecord({
        id: "e1",
        eventName: "X",
        eventType: "unknown" as "conference",
        cityName: "Amman",
        latitude: 1,
        longitude: 1,
      })
    ).toBeNull();
    expect(
      normalizeWorldEventRecord({
        id: "e2",
        eventName: "",
        eventType: "conference",
        cityName: "Amman",
        latitude: 1,
        longitude: 1,
      })
    ).toBeNull();
  });

  it("unbound events provider is fail-closed", async () => {
    const provider = createUnboundEventsDataProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listEvents()).toEqual([]);
  });
});

describe("Event clustering helper", () => {
  it("clusters at far zoom and separates when closer", () => {
    expect(isEventClusteringActiveAtZoom(3)).toBe(true);
    expect(isEventClusteringActiveAtZoom(5.6)).toBe(true);
    expect(isEventClusteringActiveAtZoom(7)).toBe(false);
  });
});

describe("Runtime events layer", () => {
  it("toggles events independently and opens event sheet", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getEventsRegistry().size()).toBe(6);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.getEducationRegistry().size()).toBeGreaterThan(0);
    expect(controller.getUsersRegistry().size()).toBeGreaterThan(0);
    expect(controller.getGamesRegistry().size()).toBeGreaterThan(0);
    expect(controller.getCommerceRegistry().size()).toBeGreaterThan(0);

    const first = controller.getEventsRegistry().listMappable()[0];
    expect(first).toBeTruthy();
    expect(controller.selectEvent(first.id)).toBe(true);
    const sheet = controller.getViewState().eventSheet;
    expect(sheet?.eventName).toBe(first.eventName);
    expect(sheet?.cityName).toBe(first.cityName);
    expect(sheet?.meta).toEqual([]);
    expect(sheet?.actions).toEqual([]);
    expect(controller.getViewState().placeSheet).toBeNull();
    expect(controller.getViewState().gameSheet).toBeNull();
    expect(controller.getViewState().commerceSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    const placesBefore = renderer.getPlaceMarkers().length;
    const gamesBefore = renderer.getGameMarkers().length;
    const commerceBefore = renderer.getCommerceMarkers().length;
    expect(renderer.getEventMarkers().length).toBeGreaterThan(0);

    controller.toggleLayer(WORLD_EVENTS_LAYER_ID, true);
    expect(controller.getSelection().selectedCategories.includes("events")).toBe(false);
    expect(renderer.getEventMarkers()).toEqual([]);
    expect(renderer.getPlaceMarkers().length).toBe(placesBefore);
    expect(renderer.getGameMarkers().length).toBe(gamesBefore);
    expect(renderer.getCommerceMarkers().length).toBe(commerceBefore);

    controller.toggleLayer(WORLD_EVENTS_LAYER_ID, true);
    expect(renderer.getEventMarkers().length).toBeGreaterThan(0);

    const sheetState = buildWorldEventSheetState(first, true);
    expect(sheetState?.actions).toEqual([]);
    expect(sheetState?.meta).toEqual([]);
  });

  it("fail-closes events when provider missing without breaking places", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [
        createDemoPlacesDataProvider(),
        createDemoGamesDataProvider(),
        createDemoCommerceDataProvider(),
      ],
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    expect(controller.getEventsRegistry().size()).toBe(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.getGamesRegistry().size()).toBeGreaterThan(0);
    expect(controller.getCommerceRegistry().size()).toBeGreaterThan(0);
    expect(controller.selectEvent("event-conference-amman")).toBe(false);
  });

  it("search finds events by name, city, and type", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(
      controller.searchWorld("Amman Tech").some((h) => h.sourceType === "events")
    ).toBe(true);
    expect(
      controller
        .searchWorld("workshop")
        .some((h) => h.id === "event-workshop-cairo")
    ).toBe(true);
    expect(
      controller
        .searchWorld("Dubai")
        .some((h) => h.sourceType === "events" && h.id === "event-festival-dubai")
    ).toBe(true);

    const hit = controller
      .searchWorld("Nile Live Showcase")
      .find((h) => h.sourceType === "events");
    expect(hit).toBeTruthy();
    expect(controller.selectSearchResult(hit!)).toBe(true);
    expect(controller.getViewState().eventSheet?.eventName).toBe("Nile Live Showcase");
  });
});
