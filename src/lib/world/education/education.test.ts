import { describe, expect, it } from "vitest";

import {
  buildWorldEducationSheetState,
  createDefaultWorldDataPipeline,
  createDemoEducationDataProvider,
  createEducationRegistry,
  createUnboundEducationDataProvider,
  createWorldDataPipeline,
  createWorldRuntimeController,
  isMapLibreRendererAdapter,
  WORLD_EDUCATION_LAYER_ID,
} from "@/src/lib/world";

describe("WorldEducationProvider", () => {
  it("demo provider returns university/school/learning_center points", async () => {
    const provider = createDemoEducationDataProvider();
    expect(provider.kind).toBe("education");
    expect(provider.isAvailable()).toBe(true);
    const rows = await provider.listEducation();
    expect(rows.length).toBeGreaterThan(0);
    const types = new Set(rows.map((r) => r.educationType));
    expect(types.has("university")).toBe(true);
    expect(types.has("school")).toBe(true);
    expect(types.has("learning_center")).toBe(true);
    for (const row of rows) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(row.cityName.length).toBeGreaterThan(0);
      expect(typeof row.latitude).toBe("number");
      expect(typeof row.longitude).toBe("number");
    }
  });

  it("unbound education provider is fail-closed", async () => {
    const provider = createUnboundEducationDataProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(await provider.listEducation()).toEqual([]);
  });
});

describe("Education pipeline integration", () => {
  it("loads education through the default pipeline", async () => {
    const pipeline = createDefaultWorldDataPipeline();
    expect(pipeline.isKindAvailable("education")).toBe(true);
    const education = await pipeline.loadEducation();
    expect(education.length).toBeGreaterThan(0);
    const bundle = await pipeline.loadAll();
    expect(bundle.education.length).toBe(education.length);
  });

  it("keeps places working when education provider is missing", async () => {
    const pipeline = createWorldDataPipeline({
      providers: [
        // places via default adapter path — register demo places only
        ...(
          await (async () => {
            const { createDemoPlacesDataProvider } = await import(
              "@/src/lib/world/dataPipeline"
            );
            return [createDemoPlacesDataProvider()];
          })()
        ),
      ],
    });
    expect(pipeline.isKindAvailable("education")).toBe(false);
    expect(await pipeline.loadEducation()).toEqual([]);
    expect((await pipeline.loadPlaces()).length).toBeGreaterThan(0);
  });
});

describe("Education registry + sheet", () => {
  it("registers valid rows and builds sheet with null placeholders", () => {
    const registry = createEducationRegistry();
    expect(
      registry.register({
        id: "edu-1",
        name: "Test University",
        educationType: "university",
        cityName: "Amman",
        latitude: 31.9,
        longitude: 35.9,
      })
    ).toBe(true);
    expect(
      registry.register({
        id: "bad",
        name: "",
        educationType: "university",
        cityName: "Amman",
        latitude: 1,
        longitude: 1,
      })
    ).toBe(false);
    const sheet = buildWorldEducationSheetState(registry.get("edu-1"), true);
    expect(sheet?.name).toBe("Test University");
    expect(sheet?.typeLabel).toBe("University");
    expect(sheet?.cityName).toBe("Amman");
    expect(sheet?.metrics.every((m) => m.value == null)).toBe(true);
    expect(sheet?.metrics.map((m) => m.id)).toEqual([
      "programs",
      "students",
      "courses",
    ]);
  });
});

describe("Runtime education layer", () => {
  it("toggles education independently of cities and opens education sheet", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    expect(controller.getEducationRegistry().size()).toBeGreaterThan(0);
    expect(
      controller
        .getViewState()
        .layers.some((l) => l.categoryId === "education" && l.enabled)
    ).toBe(true);

    const first = controller.getEducationRegistry().listMappable()[0];
    expect(first).toBeTruthy();

    expect(controller.selectEducation(first.id)).toBe(true);
    const sheet = controller.getViewState().educationSheet;
    expect(sheet?.name).toBe(first.name);
    expect(sheet?.typeLabel.length).toBeGreaterThan(0);
    expect(sheet?.cityName).toBe(first.cityName);
    expect(sheet?.metrics.every((m) => m.value == null)).toBe(true);
    expect(controller.getViewState().placeSheet).toBeNull();

    const renderer = controller.getRendererAdapter();
    expect(isMapLibreRendererAdapter(renderer)).toBe(true);
    if (!isMapLibreRendererAdapter(renderer)) return;

    expect(renderer.getSelectedEducationMarkerId()).toBe(first.id);
    expect(renderer.getEducationMarkers().length).toBeGreaterThan(0);

    const citiesBefore = renderer.getPlaceMarkers().length;

    // Layer toggle API flips when `enabled === true` (existing World UX contract).
    controller.toggleLayer(WORLD_EDUCATION_LAYER_ID, true);
    expect(
      controller.getSelection().selectedCategories.includes("education")
    ).toBe(false);
    expect(renderer.getEducationMarkers()).toEqual([]);
    expect(renderer.getPlaceMarkers().length).toBe(citiesBefore);

    controller.toggleLayer(WORLD_EDUCATION_LAYER_ID, true);
    expect(renderer.getEducationMarkers().length).toBeGreaterThan(0);

    controller.closeDetails();
    expect(controller.getViewState().educationSheet).toBeNull();
  });

  it("fail-closes education when pipeline has no education provider", async () => {
    const { createDemoPlacesDataProvider, createDemoUsersDataProvider } =
      await import("@/src/lib/world/dataPipeline");
    const pipeline = createWorldDataPipeline({
      providers: [
        createDemoPlacesDataProvider(),
        createDemoUsersDataProvider(),
      ],
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataPipeline: pipeline,
    });
    await controller.start();
    expect(controller.getEducationRegistry().size()).toBe(0);
    expect(controller.getPlaceRegistry().listCities().length).toBeGreaterThan(0);
    expect(controller.selectEducation("edu-university-jordan")).toBe(false);
  });
});
