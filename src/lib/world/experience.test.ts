import { describe, expect, it } from "vitest";

import {
  applyWorldCategoryFilter,
  buildWorldCameraControls,
  buildWorldExperienceViewState,
  buildWorldLayerControls,
  createDefaultWorldUiSelection,
  discoverWorldEntryHref,
  getWorldFoundationSnapshot,
  isWorldRendererBound,
  parseWorldCategoryId,
  parseWorldExperienceCategorySelection,
  selectWorldEntity,
  toggleWorldCategorySelection,
  WORLD_ATTRIBUTION_FALLBACK,
  WORLD_RENDERER_PREPARING_MESSAGE,
  WORLD_SCREEN_HREF,
} from "@/src/lib/world";

describe("world experience entry / destinations", () => {
  it("maps Discover World entry to the World screen safely", () => {
    expect(WORLD_SCREEN_HREF).toBe("/world");
    expect(discoverWorldEntryHref()).toBe("/world");
  });
});

describe("world experience view state", () => {
  it("shows unavailable shell with no fake entities when renderer unbound", () => {
    expect(isWorldRendererBound()).toBe(false);
    const view = buildWorldExperienceViewState();
    expect(view.phase).toBe("unavailable");
    expect(view.rendererBound).toBe(false);
    expect(view.entities).toEqual([]);
    expect(view.message).toBe(WORLD_RENDERER_PREPARING_MESSAGE);
    expect(view.attribution).toBe(WORLD_ATTRIBUTION_FALLBACK);
    expect(JSON.stringify(view)).not.toMatch(
      /google|mapbox|cesium|pmtiles|maplibre|lat(?:itude)?\s*[:=]/i
    );
  });

  it("disables all layer controls when no data source is bound", () => {
    const snap = getWorldFoundationSnapshot();
    const layers = buildWorldLayerControls(snap, ["events"]);
    expect(layers.length).toBe(8);
    expect(layers.every((layer) => layer.enabled === false)).toBe(true);
    expect(layers.every((layer) => layer.active === false)).toBe(true);
    expect(layers.every((layer) => typeof layer.reason === "string")).toBe(
      true
    );
  });

  it("disables camera controls when renderer is unbound", () => {
    const controls = buildWorldCameraControls(false);
    expect(controls.map((c) => c.id)).toEqual([
      "zoom_in",
      "zoom_out",
      "recenter",
      "reset_orientation",
    ]);
    expect(controls.every((c) => c.enabled === false)).toBe(true);
  });

  it("tracks filter selection only for known categories", () => {
    const selected = toggleWorldCategorySelection([], "games", true);
    expect(selected).toEqual(["games"]);
    // Disabled layers cannot toggle selection
    expect(toggleWorldCategorySelection(selected, "ai", false)).toEqual([
      "games",
    ]);
    const filter = applyWorldCategoryFilter(
      { categories: [], query: null, bbox: null },
      selected
    );
    expect(filter.categories).toEqual(["games"]);
    expect(parseWorldExperienceCategorySelection(["games", "planets", "ai"])).toEqual(
      ["games", "ai"]
    );
    expect(parseWorldCategoryId("planets")).toBeNull();
  });

  it("opens details only for an explicit entity selection", () => {
    const base = createDefaultWorldUiSelection();
    const opened = selectWorldEntity(base, "entity-1");
    expect(opened.selectedEntityId).toBe("entity-1");
    expect(opened.detailsOpen).toBe(true);
    const closed = selectWorldEntity(opened, null);
    expect(closed.selectedEntityId).toBeNull();
    expect(closed.detailsOpen).toBe(false);
  });

  it("uses attribution fallback and error/loading phases fail closed", () => {
    expect(
      buildWorldExperienceViewState({ loading: true }).phase
    ).toBe("loading");
    const errored = buildWorldExperienceViewState({
      errorMessage: "boom",
    });
    expect(errored.phase).toBe("error");
    expect(errored.errorMessage).toBe("boom");
    expect(errored.entities).toEqual([]);
    expect(errored.cameraControls.every((c) => c.enabled === false)).toBe(
      true
    );
    expect(
      buildWorldExperienceViewState({ attribution: "  Custom credit  " })
        .attribution
    ).toBe("Custom credit");
  });
});
