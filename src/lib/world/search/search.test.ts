import { describe, expect, it } from "vitest";

import {
  buildWorldSearchDataset,
  createDefaultWorldDataPipeline,
  createDemoEducationDataProvider,
  createDemoPlacesDataProvider,
  createWorldDataPipeline,
  createWorldRuntimeController,
  createWorldSearchService,
  isMapLibreRendererAdapter,
} from "@/src/lib/world";
import { listDemoPlaces } from "@/src/lib/world/places";

describe("WorldSearchService", () => {
  const service = createWorldSearchService();

  async function demoDataset() {
    const places = await createDemoPlacesDataProvider().listPlaces();
    const education = await createDemoEducationDataProvider().listEducation();
    const { createDemoUsersDataProvider, createDemoGamesDataProvider, createDemoCommerceDataProvider, createDemoEventsDataProvider } =
      await import("@/src/lib/world");
    const users = await createDemoUsersDataProvider().listUsers();
    const games = await createDemoGamesDataProvider().listGames();
    const commerce = await createDemoCommerceDataProvider().listCommerce();
    const events = await createDemoEventsDataProvider().listEvents();
    return buildWorldSearchDataset({
      placesAvailable: true,
      educationAvailable: true,
      usersAvailable: true,
      gamesAvailable: true,
      commerceAvailable: true,
      eventsAvailable: true,
      places,
      education,
      users,
      games,
      commerce,
      events,
    });
  }

  it("returns empty for empty / whitespace query", async () => {
    const dataset = await demoDataset();
    expect(service.search("", dataset)).toEqual([]);
    expect(service.search("   ", dataset)).toEqual([]);
  });

  it("matches partial and case-insensitive place names", async () => {
    const dataset = await demoDataset();
    const hits = service.search("amm", dataset);
    expect(hits.some((h) => h.id === "place-amman")).toBe(true);
    expect(service.search("AMMAN", dataset).some((h) => h.id === "place-amman")).toBe(
      true
    );
  });

  it("matches place country name", async () => {
    const dataset = await demoDataset();
    const hits = service.search("jordan", dataset);
    expect(hits.some((h) => h.sourceType === "places")).toBe(true);
    expect(hits.every((h) => h.title.length > 0)).toBe(true);
  });

  it("matches education by name and related city", async () => {
    const dataset = await demoDataset();
    expect(
      service.search("cairo university", dataset).some(
        (h) => h.sourceType === "education"
      )
    ).toBe(true);
    const byCity = service.search("dubai", dataset);
    expect(
      byCity.some(
        (h) => h.sourceType === "education" && h.id === "edu-dubai-learning-hub"
      )
    ).toBe(true);
  });

  it("searches across Places, Education, Users, Games, Commerce, and Events", async () => {
    const dataset = await demoDataset();
    const hits = service.search("a", dataset);
    expect(hits.some((h) => h.sourceType === "places")).toBe(true);
    expect(hits.some((h) => h.sourceType === "education")).toBe(true);
    expect(hits.some((h) => h.sourceType === "users")).toBe(true);
    expect(service.search("game", dataset).some((h) => h.sourceType === "games")).toBe(
      true
    );
    expect(
      service.search("store", dataset).some((h) => h.sourceType === "commerce")
    ).toBe(true);
    expect(
      service.search("conference", dataset).some((h) => h.sourceType === "events")
    ).toBe(true);
    for (const hit of hits) {
      expect(hit.id).toBeTruthy();
      expect(hit.title).toBeTruthy();
      expect(
        hit.sourceType === "places" ||
          hit.sourceType === "education" ||
          hit.sourceType === "users" ||
          hit.sourceType === "games" ||
          hit.sourceType === "commerce" ||
          hit.sourceType === "events"
      ).toBe(true);
    }
  });

  it("fail-closes missing provider kinds without breaking others", async () => {
    const places = listDemoPlaces();
    const education = await createDemoEducationDataProvider().listEducation();
    const { createDemoUsersDataProvider, createDemoGamesDataProvider, createDemoCommerceDataProvider, createDemoEventsDataProvider } =
      await import("@/src/lib/world");
    const users = await createDemoUsersDataProvider().listUsers();
    const games = await createDemoGamesDataProvider().listGames();
    const commerce = await createDemoCommerceDataProvider().listCommerce();
    const events = await createDemoEventsDataProvider().listEvents();
    const placesOnly = buildWorldSearchDataset({
      placesAvailable: true,
      educationAvailable: false,
      usersAvailable: false,
      gamesAvailable: false,
      commerceAvailable: false,
      eventsAvailable: false,
      places,
      education,
      users,
      games,
      commerce,
      events,
    });
    const hits = service.search("amman", placesOnly);
    expect(hits.every((h) => h.sourceType === "places")).toBe(true);
    expect(hits.length).toBeGreaterThan(0);

    const eduOnly = buildWorldSearchDataset({
      placesAvailable: false,
      educationAvailable: true,
      usersAvailable: false,
      gamesAvailable: false,
      commerceAvailable: false,
      eventsAvailable: false,
      places,
      education,
      users,
      games,
      commerce,
      events,
    });
    const eduHits = service.search("university", eduOnly);
    expect(eduHits.every((h) => h.sourceType === "education")).toBe(true);
    expect(eduHits.length).toBeGreaterThan(0);
  });

  it("never invents results for unknown queries", async () => {
    const dataset = await demoDataset();
    expect(service.search("zzzz-not-a-real-place-xyz", dataset)).toEqual([]);
  });
});

describe("Runtime search + selection", () => {
  it("searches via Runtime and opens the correct sheet with camera focus", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.searchWorld("")).toEqual([]);
    const placeHits = controller.searchWorld("amman");
    expect(placeHits.some((h) => h.id === "place-amman")).toBe(true);

    const placeHit = placeHits.find((h) => h.id === "place-amman")!;
    expect(controller.selectSearchResult(placeHit)).toBe(true);
    expect(controller.getViewState().placeSheet?.name).toBe("Amman");
    expect(controller.getViewState().educationSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;
    expect(renderer.getSessionCamera().zoom).toBeGreaterThanOrEqual(6);

    const eduHits = controller.searchWorld("king saud");
    const eduHit = eduHits.find((h) => h.sourceType === "education");
    expect(eduHit).toBeTruthy();
    expect(controller.selectSearchResult(eduHit!)).toBe(true);
    expect(controller.getViewState().educationSheet?.name).toContain("King Saud");
    expect(controller.getViewState().placeSheet).toBeNull();
  });

  it("keeps search working when education is unbound", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [createDemoPlacesDataProvider()],
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    const hits = controller.searchWorld("amman");
    expect(hits.every((h) => h.sourceType === "places")).toBe(true);
    expect(hits.length).toBeGreaterThan(0);
  });

  it("pipeline-backed default search sees places, education, users, games, commerce, and events", async () => {
    const pipeline = createDefaultWorldDataPipeline();
    expect(pipeline.isKindAvailable("places")).toBe(true);
    expect(pipeline.isKindAvailable("education")).toBe(true);
    expect(pipeline.isKindAvailable("users")).toBe(true);
    expect(pipeline.isKindAvailable("games")).toBe(true);
    expect(pipeline.isKindAvailable("commerce")).toBe(true);
    expect(pipeline.isKindAvailable("events")).toBe(true);
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    const hits = controller.searchWorld("a");
    expect(hits.some((h) => h.sourceType === "places")).toBe(true);
    expect(hits.some((h) => h.sourceType === "education")).toBe(true);
    expect(hits.some((h) => h.sourceType === "users")).toBe(true);
    expect(
      controller.searchWorld("game").some((h) => h.sourceType === "games")
    ).toBe(true);
    expect(
      controller.searchWorld("store").some((h) => h.sourceType === "commerce")
    ).toBe(true);
    expect(
      controller.searchWorld("festival").some((h) => h.sourceType === "events")
    ).toBe(true);
  });
});
