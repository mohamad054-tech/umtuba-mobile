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
    const { createDemoUsersDataProvider } = await import("@/src/lib/world");
    const users = await createDemoUsersDataProvider().listUsers();
    return buildWorldSearchDataset({
      placesAvailable: true,
      educationAvailable: true,
      usersAvailable: true,
      places,
      education,
      users,
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

  it("searches across Places, Education, and Users", async () => {
    const dataset = await demoDataset();
    const hits = service.search("a", dataset);
    expect(hits.some((h) => h.sourceType === "places")).toBe(true);
    expect(hits.some((h) => h.sourceType === "education")).toBe(true);
    expect(hits.some((h) => h.sourceType === "users")).toBe(true);
    for (const hit of hits) {
      expect(hit.id).toBeTruthy();
      expect(hit.title).toBeTruthy();
      expect(
        hit.sourceType === "places" ||
          hit.sourceType === "education" ||
          hit.sourceType === "users"
      ).toBe(true);
    }
  });

  it("fail-closes missing provider kinds without breaking others", async () => {
    const places = listDemoPlaces();
    const education = await createDemoEducationDataProvider().listEducation();
    const { createDemoUsersDataProvider } = await import("@/src/lib/world");
    const users = await createDemoUsersDataProvider().listUsers();
    const placesOnly = buildWorldSearchDataset({
      placesAvailable: true,
      educationAvailable: false,
      usersAvailable: false,
      places,
      education,
      users,
    });
    const hits = service.search("amman", placesOnly);
    expect(hits.every((h) => h.sourceType === "places")).toBe(true);
    expect(hits.length).toBeGreaterThan(0);

    const eduOnly = buildWorldSearchDataset({
      placesAvailable: false,
      educationAvailable: true,
      usersAvailable: false,
      places,
      education,
      users,
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

  it("pipeline-backed default search sees places, education, and users", async () => {
    const pipeline = createDefaultWorldDataPipeline();
    expect(pipeline.isKindAvailable("places")).toBe(true);
    expect(pipeline.isKindAvailable("education")).toBe(true);
    expect(pipeline.isKindAvailable("users")).toBe(true);
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    const hits = controller.searchWorld("a");
    expect(hits.some((h) => h.sourceType === "places")).toBe(true);
    expect(hits.some((h) => h.sourceType === "education")).toBe(true);
    expect(hits.some((h) => h.sourceType === "users")).toBe(true);
  });
});
