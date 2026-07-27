/**
 * World Experience view-state — UI contracts over World Foundation.
 * Does not invent map data, entities, or a parallel domain model.
 */

import { emptyWorldFilter } from "@/src/lib/world/actions";
import {
  createDisabledWorldRendererAdapter,
  isWorldRendererBound,
} from "@/src/lib/world/adapter";
import {
  listWorldCategories,
  parseWorldCategoryId,
} from "@/src/lib/world/categories";
import {
  getWorldFoundationSnapshot,
  isWorldFoundationConfigured,
} from "@/src/lib/world/foundation";
import { mapWorldDestination } from "@/src/lib/world/mapDestination";
import type { WorldRendererAdapter } from "@/src/lib/world/renderer";
import type {
  WorldCategoryId,
  WorldEntity,
  WorldFilter,
  WorldFoundationSnapshot,
  WorldRendererCapability,
} from "@/src/lib/world/types";

export type WorldExperiencePhase =
  | "preparing"
  | "loading"
  | "unavailable"
  | "error"
  | "ready";

export type WorldCameraControlId =
  | "zoom_in"
  | "zoom_out"
  | "recenter"
  | "reset_orientation";

export type WorldLayerControlState = {
  categoryId: WorldCategoryId;
  label: string;
  /** Interactive only when a trusted data source backs this category. */
  enabled: boolean;
  active: boolean;
  reason: string | null;
};

export type WorldCameraControlState = {
  id: WorldCameraControlId;
  label: string;
  enabled: boolean;
};

export type WorldUiSelectionState = {
  selectedCategories: WorldCategoryId[];
  selectedEntityId: string | null;
  detailsOpen: boolean;
  filterPanelOpen: boolean;
  layersPanelOpen: boolean;
  /** Places UX sub-layers: Capitals / Major / Minor. */
  selectedPlaceLayers: import("@/src/lib/world/places").WorldPlaceLayerId[];
  placeSheetOpen: boolean;
  educationSheetOpen: boolean;
  userSheetOpen: boolean;
  gameSheetOpen: boolean;
  commerceSheetOpen: boolean;
};

export type WorldPlaceLayerControlState = {
  layerId: import("@/src/lib/world/places").WorldPlaceLayerId;
  label: string;
  enabled: boolean;
  active: boolean;
  reason: string | null;
};

export type WorldExperienceViewState = {
  phase: WorldExperiencePhase;
  message: string;
  errorMessage: string | null;
  rendererBound: boolean;
  foundationConfigured: boolean;
  layers: WorldLayerControlState[];
  placeLayers: WorldPlaceLayerControlState[];
  cameraControls: WorldCameraControlState[];
  filter: WorldFilter;
  selectedEntityId: string | null;
  detailsOpen: boolean;
  filterPanelOpen: boolean;
  layersPanelOpen: boolean;
  placeSheet: import("@/src/lib/world/places").WorldPlaceSheetState | null;
  educationSheet: import("@/src/lib/world/education").WorldEducationSheetState | null;
  userSheet: import("@/src/lib/world/users").WorldUserSheetState | null;
  gameSheet: import("@/src/lib/world/games").WorldGameSheetState | null;
  commerceSheet: import("@/src/lib/world/commerce").WorldCommerceSheetState | null;
  /** Trusted entities from Runtime (e.g. Places). */
  entities: WorldEntity[];
  attribution: string;
  renderer: WorldRendererCapability;
};

export const WORLD_SCREEN_HREF = "/world" as const;

export const WORLD_ATTRIBUTION_FALLBACK =
  "World data credits will appear here when the map source is connected.";

export const WORLD_RENDERER_PREPARING_MESSAGE =
  "The owned World map renderer is being prepared. No map imagery or locations are shown yet.";

/** Brief yield so Retry can paint a loading/preparing cycle on device. */
export const WORLD_RETRY_YIELD_MS = 180;

export type WorldInitializationResult =
  | { ok: true; snapshot: WorldFoundationSnapshot }
  | { ok: false; message: string };

/**
 * Re-run World foundation initialization.
 * Always performs work (including a short yield) so Retry is never a silent no-op,
 * even when the result remains unavailable without a data source.
 */
export async function runWorldInitialization(options?: {
  yieldMs?: number;
}): Promise<WorldInitializationResult> {
  const yieldMs =
    typeof options?.yieldMs === "number" && options.yieldMs >= 0
      ? options.yieldMs
      : WORLD_RETRY_YIELD_MS;

  if (yieldMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, yieldMs);
    });
  }

  try {
    return { ok: true, snapshot: getWorldFoundationSnapshot() };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unable to load World.",
    };
  }
}

export function createDefaultWorldUiSelection(): WorldUiSelectionState {
  return {
    selectedCategories: [],
    selectedEntityId: null,
    detailsOpen: false,
    filterPanelOpen: false,
    layersPanelOpen: false,
    selectedPlaceLayers: [
      "cities_capitals",
      "cities_major",
      "cities_minor",
    ],
    placeSheetOpen: false,
    educationSheetOpen: false,
    userSheetOpen: false,
    gameSheetOpen: false,
    commerceSheetOpen: false,
  };
}

export function buildWorldCameraControls(
  rendererBound: boolean
): WorldCameraControlState[] {
  const enabled = rendererBound === true;
  return [
    { id: "zoom_in", label: "Zoom in", enabled },
    { id: "zoom_out", label: "Zoom out", enabled },
    { id: "recenter", label: "Recenter", enabled },
    { id: "reset_orientation", label: "Reset orientation", enabled },
  ];
}

/**
 * Layer toggles for product categories.
 * Enabled only when the category is supported and a real layer exists in the snapshot.
 */
export function buildWorldLayerControls(
  snapshot: WorldFoundationSnapshot,
  selectedCategories: WorldCategoryId[]
): WorldLayerControlState[] {
  const selected = new Set(selectedCategories);
  const categories = listWorldCategories({ includeUnsupported: true });
  const layersByCategory = new Set(
    snapshot.layers
      .map((layer) => layer.category)
      .filter((c): c is WorldCategoryId => c != null)
  );

  return categories.map((category) => {
    const hasData =
      category.supported === true && layersByCategory.has(category.id);
    if (!hasData) {
      return {
        categoryId: category.id,
        label: category.label,
        enabled: false,
        active: false,
        reason: category.supported
          ? "No trusted World data is available for this layer yet."
          : "This World layer is not available yet.",
      };
    }
    return {
      categoryId: category.id,
      label: category.label,
      enabled: true,
      active: selected.has(category.id),
      reason: null,
    };
  });
}

export function toggleWorldCategorySelection(
  current: WorldCategoryId[],
  categoryId: WorldCategoryId,
  enabled: boolean
): WorldCategoryId[] {
  if (!enabled) return current;
  if (current.includes(categoryId)) {
    return current.filter((id) => id !== categoryId);
  }
  return [...current, categoryId];
}

export function applyWorldCategoryFilter(
  filter: WorldFilter,
  selectedCategories: WorldCategoryId[]
): WorldFilter {
  return {
    ...filter,
    categories: [...selectedCategories],
  };
}

export function selectWorldEntity(
  selection: WorldUiSelectionState,
  entityId: string | null
): WorldUiSelectionState {
  if (!entityId) {
    return {
      ...selection,
      selectedEntityId: null,
      detailsOpen: false,
    };
  }
  return {
    ...selection,
    selectedEntityId: entityId,
    detailsOpen: true,
  };
}

/**
 * Build the experience view model from foundation + UI selection.
 * Never invents entities, coordinates, or counts.
 */
export function buildWorldExperienceViewState(options?: {
  snapshot?: WorldFoundationSnapshot;
  selection?: WorldUiSelectionState;
  loading?: boolean;
  errorMessage?: string | null;
  attribution?: string | null;
  rendererAdapter?: WorldRendererAdapter | null;
  /** Trusted entities from Runtime (e.g. Places) — never invented in UI. */
  entities?: WorldEntity[];
  placeLayers?: WorldPlaceLayerControlState[];
  placeSheet?: import("@/src/lib/world/places").WorldPlaceSheetState | null;
  educationSheet?: import("@/src/lib/world/education").WorldEducationSheetState | null;
  userSheet?: import("@/src/lib/world/users").WorldUserSheetState | null;
  gameSheet?: import("@/src/lib/world/games").WorldGameSheetState | null;
  commerceSheet?: import("@/src/lib/world/commerce").WorldCommerceSheetState | null;
}): WorldExperienceViewState {
  const loading = options?.loading === true;
  const errorMessage =
    typeof options?.errorMessage === "string" &&
    options.errorMessage.trim().length > 0
      ? options.errorMessage.trim()
      : null;
  const selection = options?.selection ?? createDefaultWorldUiSelection();
  const snapshot = options?.snapshot ?? getWorldFoundationSnapshot();
  const rendererAdapter =
    options?.rendererAdapter ?? createDisabledWorldRendererAdapter();
  const rendererBound = isWorldRendererBound(rendererAdapter);
  const foundationConfigured = isWorldFoundationConfigured();
  const attribution =
    typeof options?.attribution === "string" &&
    options.attribution.trim().length > 0
      ? options.attribution.trim()
      : WORLD_ATTRIBUTION_FALLBACK;
  const entities = Array.isArray(options?.entities) ? options.entities : [];
  const placeLayers = Array.isArray(options?.placeLayers)
    ? options.placeLayers
    : [];
  const placeSheet = options?.placeSheet ?? null;
  const educationSheet = options?.educationSheet ?? null;
  const userSheet = options?.userSheet ?? null;
  const gameSheet = options?.gameSheet ?? null;
  const commerceSheet = options?.commerceSheet ?? null;

  if (loading) {
    return {
      phase: "loading",
      message: "Loading World…",
      errorMessage: null,
      rendererBound,
      foundationConfigured,
      layers: buildWorldLayerControls(snapshot, selection.selectedCategories),
      placeLayers,
      cameraControls: buildWorldCameraControls(rendererBound),
      filter: applyWorldCategoryFilter(
        snapshot.filter ?? emptyWorldFilter(),
        selection.selectedCategories
      ),
      selectedEntityId: null,
      detailsOpen: false,
      filterPanelOpen: false,
      layersPanelOpen: false,
      placeSheet: null,
      educationSheet: null,
      userSheet: null,
      gameSheet: null,
      commerceSheet: null,
      entities: [],
      attribution,
      renderer: snapshot.renderer ?? rendererAdapter.capability,
    };
  }

  if (errorMessage) {
    return {
      phase: "error",
      message: "Unable to load World.",
      errorMessage,
      rendererBound,
      foundationConfigured,
      layers: buildWorldLayerControls(snapshot, selection.selectedCategories),
      placeLayers,
      cameraControls: buildWorldCameraControls(false),
      filter: emptyWorldFilter(),
      selectedEntityId: null,
      detailsOpen: false,
      filterPanelOpen: false,
      layersPanelOpen: false,
      placeSheet: null,
      educationSheet: null,
      userSheet: null,
      gameSheet: null,
      commerceSheet: null,
      entities: [],
      attribution,
      renderer: rendererAdapter.capability,
    };
  }

  const layers = buildWorldLayerControls(
    snapshot,
    selection.selectedCategories
  );
  const phase: WorldExperiencePhase =
    snapshot.status === "unavailable" || !foundationConfigured
      ? "unavailable"
      : "ready";

  return {
    phase,
    message:
      phase === "unavailable"
        ? WORLD_RENDERER_PREPARING_MESSAGE
        : snapshot.message,
    errorMessage: null,
    rendererBound,
    foundationConfigured,
    layers,
    placeLayers,
    cameraControls: buildWorldCameraControls(rendererBound),
    filter: applyWorldCategoryFilter(
      snapshot.filter ?? emptyWorldFilter(),
      selection.selectedCategories
    ),
    selectedEntityId: selection.selectedEntityId,
    detailsOpen: selection.detailsOpen && selection.selectedEntityId != null,
    filterPanelOpen: selection.filterPanelOpen,
    layersPanelOpen: selection.layersPanelOpen,
    placeSheet,
    educationSheet,
    userSheet,
    gameSheet,
    commerceSheet,
    entities,
    attribution,
    renderer: snapshot.renderer ?? rendererAdapter.capability,
  };
}

/** Safe Discover → World entry href. Fail-closed if mapping rejects. */
export function discoverWorldEntryHref(): string | null {
  return mapWorldDestination(WORLD_SCREEN_HREF);
}

export function parseWorldExperienceCategorySelection(
  raw: unknown
): WorldCategoryId[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldCategoryId[] = [];
  for (const item of raw) {
    const id = parseWorldCategoryId(typeof item === "string" ? item : null);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
