import { describe, expect, it } from "vitest";

import {
  buildWorldLayerControls,
  buildWorldPlaceSheetState,
  createDefaultWorldUiSelection,
  createWorldRuntimeController,
  createWorldSearchService,
  defaultNullRendererCapabilities,
  getWorldFoundationSnapshot,
  listWorldCategories,
  STREET_MAP_SOURCE_ID,
} from "@/src/lib/world";
import { buildWorldProjectionControls } from "@/src/lib/world/experience";
import { listDemoPlaces } from "@/src/lib/world/places";
import { buildWorldEducationSheetState } from "@/src/lib/world/education";
import { buildWorldUserSheetState } from "@/src/lib/world/users";
import { buildWorldGameSheetState } from "@/src/lib/world/games";
import { buildWorldCommerceSheetState } from "@/src/lib/world/commerce";
import { buildWorldEventSheetState } from "@/src/lib/world/events";

describe("World Product Surface Hardening V1", () => {
  it("defaults to Streets map source and Cities/Places layer on", async () => {
    const selection = createDefaultWorldUiSelection();
    expect(selection.selectedCategories).toEqual(["cities"]);
    expect(selection.layersPanelOpen).toBe(true);
    expect(selection.selectedPlaceLayers.length).toBeGreaterThan(0);

    const controller = createWorldRuntimeController({ yieldMs: 0 });
    expect(controller.getSelectedMapSource()?.id).toBe(STREET_MAP_SOURCE_ID);
    await controller.start();

    const view = controller.getViewState();
    expect(view.mapSources.every((s) => s.kind !== "demo")).toBe(true);
    expect(view.mapSources.some((s) => s.id === STREET_MAP_SOURCE_ID && s.active)).toBe(
      true
    );
    expect(
      view.layers.find((l) => l.categoryId === "cities")?.active
    ).toBe(true);
    expect(view.projectionControls).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/Coming soon|Owned World|development map/i);
  });

  it("orders product layers Places → Education → Users → Games → Commerce → Events", () => {
    expect(listWorldCategories().map((c) => c.label)).toEqual([
      "Places",
      "Education",
      "Users",
      "Games",
      "Commerce",
      "Events",
    ]);
    const layers = buildWorldLayerControls(getWorldFoundationSnapshot(), [
      "cities",
    ]);
    expect(layers.map((l) => l.categoryId)).toEqual([
      "cities",
      "education",
      "users",
      "games",
      "businesses",
      "events",
    ]);
    expect(layers.every((l) => l.categoryId !== "ai" && l.categoryId !== "future")).toBe(
      true
    );
  });

  it("hides unsupported globe controls from product view-state", () => {
    const controls = buildWorldProjectionControls(
      defaultNullRendererCapabilities(),
      "auto",
      "mercator"
    );
    expect(controls).toEqual([]);
  });

  it("bottom sheets expose only real fields (no placeholders)", () => {
    const place = listDemoPlaces()[0];
    expect(buildWorldPlaceSheetState(place, true)?.metrics).toEqual([]);
    expect(buildWorldEducationSheetState(null, true)).toBeNull();

    const controllerSheets = {
      place: buildWorldPlaceSheetState(place, true),
    };
    expect(JSON.stringify(controllerSheets)).not.toMatch(/Coming soon/i);
  });

  it("sheet builders for all domains omit placeholder actions/metrics", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();

    const edu = controller.getEducationRegistry().listMappable()[0];
    const user = controller.getUsersRegistry().listMappable()[0];
    const game = controller.getGamesRegistry().listMappable()[0];
    const commerce = controller.getCommerceRegistry().listMappable()[0];
    const event = controller.getEventsRegistry().listMappable()[0];

    expect(buildWorldEducationSheetState(edu, true)?.metrics).toEqual([]);
    expect(buildWorldUserSheetState(user, true)?.actions).toEqual([]);
    expect(buildWorldGameSheetState(game, true)?.actions).toEqual([]);
    expect(buildWorldGameSheetState(game, true)?.meta).toEqual([]);
    expect(buildWorldCommerceSheetState(commerce, true)?.actions).toEqual([]);
    expect(buildWorldCommerceSheetState(commerce, true)?.meta).toEqual([]);
    expect(buildWorldEventSheetState(event, true)?.actions).toEqual([]);
    expect(buildWorldEventSheetState(event, true)?.meta).toEqual([]);
  });

  it("search still selects results and focuses without changing Runtime architecture", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    const results = controller.searchWorld("Amman");
    expect(results.length).toBeGreaterThan(0);
    const hit = results[0];
    expect(controller.selectSearchResult(hit)).toBe(true);
    expect(controller.getViewState().placeSheet?.name).toMatch(/Amman/i);

    const service = createWorldSearchService();
    expect(typeof service.search).toBe("function");
  });

  it("keeps Runtime architecture intact (pipeline + renderer bound)", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(controller.getRuntimeState().phase).toMatch(/ready|unavailable/);
    expect(controller.getRendererAdapter().isBound()).toBe(true);
    expect(controller.getLastDataBundle()).not.toBeNull();
    expect(controller.getPlaceRegistry().size()).toBeGreaterThan(0);
  });
});
