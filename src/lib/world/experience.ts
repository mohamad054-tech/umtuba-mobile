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
  RendererCapabilities,
  WorldMapProjection,
} from "@/src/lib/world/renderer/types";
import type {
  WorldBuildingsMode,
  WorldRoadDetail,
} from "@/src/lib/world/renderer/maplibre/roadsBuildings";
import type {
  WorldCategoryId,
  WorldEntity,
  WorldFilter,
  WorldFoundationSnapshot,
  WorldRendererCapability,
} from "@/src/lib/world/types";

export type {
  WorldBuildingsMode,
  WorldRoadDetail,
} from "@/src/lib/world/renderer/maplibre/roadsBuildings";

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
  eventSheetOpen: boolean;
};

export type WorldPlaceLayerControlState = {
  layerId: import("@/src/lib/world/places").WorldPlaceLayerId;
  label: string;
  enabled: boolean;
  active: boolean;
  reason: string | null;
};

export type WorldMapSourceControlState = {
  id: string;
  label: string;
  kind: import("@/src/lib/world/mapSource").WorldMapSourceKind;
  active: boolean;
  enabled: boolean;
  reason: string | null;
};

export type WorldProjectionPreference = "auto" | "globe" | "map";

export type WorldProjectionControlId = "globe" | "map";

export type WorldProjectionControlState = {
  id: WorldProjectionControlId;
  label: string;
  active: boolean;
  enabled: boolean;
  reason: string | null;
};

export type WorldRoadDetailControlState = {
  id: WorldRoadDetail;
  label: string;
  active: boolean;
  enabled: boolean;
  reason: string | null;
};

export type WorldBuildingsControlState = {
  id: WorldBuildingsMode;
  label: string;
  active: boolean;
  enabled: boolean;
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
  mapSources: WorldMapSourceControlState[];
  projectionControls: WorldProjectionControlState[];
  activeProjection: WorldMapProjection;
  projectionPreference: WorldProjectionPreference;
  roadDetailControls: WorldRoadDetailControlState[];
  roadDetail: WorldRoadDetail;
  buildingsControls: WorldBuildingsControlState[];
  buildingsMode: WorldBuildingsMode;
  effectiveBuildingsMode: WorldBuildingsMode;
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
  eventSheet: import("@/src/lib/world/events").WorldEventSheetState | null;
  /** Trusted entities from Runtime (e.g. Places). */
  entities: WorldEntity[];
  attribution: string;
  renderer: WorldRendererCapability;
};

export const WORLD_SCREEN_HREF = "/world" as const;

export const WORLD_ATTRIBUTION_FALLBACK =
  "Map data credits appear when a map source is connected.";

export const WORLD_RENDERER_PREPARING_MESSAGE = "Loading map…";

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
    /** Cities/Places on by default so the first open is never an empty map. */
    selectedCategories: ["cities"],
    selectedEntityId: null,
    detailsOpen: false,
    filterPanelOpen: false,
    layersPanelOpen: true,
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
    eventSheetOpen: false,
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
  /** Product UI: supported layers only (hide AI / Future stubs). */
  const categories = listWorldCategories({ includeUnsupported: false });
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
        reason: "No World data is available for this layer yet.",
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

/** Streets / Satellite / Terrain switcher controls — UI never sees style URLs. */
export function buildWorldMapSourceControls(
  sources: Array<{
    id: string;
    label: string;
    kind: import("@/src/lib/world/mapSource").WorldMapSourceKind;
    enabled: boolean;
  }>,
  activeSourceId: string | null
): WorldMapSourceControlState[] {
  return sources.map((source) => ({
    id: source.id,
    label: source.label,
    kind: source.kind,
    active: activeSourceId === source.id,
    enabled: source.enabled,
    reason: source.enabled ? null : "This map source is not available yet.",
  }));
}

/**
 * Globe / Map projection switcher — product UI omits unsupported options.
 * When Globe is unavailable, returns [] so the control row is hidden entirely.
 */
export function buildWorldProjectionControls(
  caps: RendererCapabilities,
  preference: WorldProjectionPreference,
  activeProjection: WorldMapProjection
): WorldProjectionControlState[] {
  const globeEnabled = caps.supportsGlobe === true;
  if (!globeEnabled) {
    return [];
  }

  const globeActive =
    preference === "globe" ||
    (preference === "auto" && activeProjection === "globe");
  const mapActive =
    preference === "map" ||
    (preference === "auto" && activeProjection === "mercator");

  return [
    {
      id: "globe",
      label: "Globe",
      active: globeActive,
      enabled: true,
      reason: null,
    },
    {
      id: "map",
      label: "Map",
      active: mapActive,
      enabled: true,
      reason: null,
    },
  ];
}

/** Road detail chips — disabled when the active map source has no road experience. */
export function buildWorldRoadDetailControls(
  sourceSupportsRoadDetail: boolean,
  active: WorldRoadDetail
): WorldRoadDetailControlState[] {
  const levels: Array<{ id: WorldRoadDetail; label: string }> = [
    { id: "low", label: "Roads Low" },
    { id: "medium", label: "Roads Med" },
    { id: "high", label: "Roads High" },
  ];
  return levels.map((level) => ({
    id: level.id,
    label: level.label,
    active: sourceSupportsRoadDetail && active === level.id,
    enabled: sourceSupportsRoadDetail,
    reason: sourceSupportsRoadDetail
      ? null
      : "Road detail is not available for this map source.",
  }));
}

/** Buildings chips — 3D enabled only when renderer + source both support it. */
export function buildWorldBuildingsControls(
  options: {
    supportsBuildings: boolean;
    supports3D: boolean;
    sourceSupports2d: boolean;
    sourceSupports3d: boolean;
  },
  preference: WorldBuildingsMode,
  effective: WorldBuildingsMode
): WorldBuildingsControlState[] {
  const offEnabled = true;
  const twoDEnabled =
    options.supportsBuildings === true && options.sourceSupports2d === true;
  const threeDEnabled =
    options.supportsBuildings === true &&
    options.supports3D === true &&
    options.sourceSupports3d === true;

  return [
    {
      id: "off",
      label: "Buildings Off",
      active: effective === "off" || preference === "off",
      enabled: offEnabled,
      reason: null,
    },
    {
      id: "2d",
      label: "Buildings 2D",
      active: preference === "2d" && twoDEnabled,
      enabled: twoDEnabled,
      reason: twoDEnabled
        ? null
        : "2D buildings are not available for this map source.",
    },
    {
      id: "3d",
      label: "Buildings 3D",
      active: preference === "3d" && threeDEnabled,
      enabled: threeDEnabled,
      reason: threeDEnabled
        ? null
        : "3D buildings are not available on this device yet.",
    },
  ];
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
  mapSources?: WorldMapSourceControlState[];
  projectionControls?: WorldProjectionControlState[];
  projectionPreference?: WorldProjectionPreference;
  activeProjection?: WorldMapProjection;
  roadDetailControls?: WorldRoadDetailControlState[];
  roadDetail?: WorldRoadDetail;
  buildingsControls?: WorldBuildingsControlState[];
  buildingsMode?: WorldBuildingsMode;
  effectiveBuildingsMode?: WorldBuildingsMode;
  placeSheet?: import("@/src/lib/world/places").WorldPlaceSheetState | null;
  educationSheet?: import("@/src/lib/world/education").WorldEducationSheetState | null;
  userSheet?: import("@/src/lib/world/users").WorldUserSheetState | null;
  gameSheet?: import("@/src/lib/world/games").WorldGameSheetState | null;
  commerceSheet?: import("@/src/lib/world/commerce").WorldCommerceSheetState | null;
  eventSheet?: import("@/src/lib/world/events").WorldEventSheetState | null;
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
  const mapSources = Array.isArray(options?.mapSources)
    ? options.mapSources
    : [];
  const caps = rendererAdapter.getCapabilities();
  const projectionPreference = options?.projectionPreference ?? "auto";
  const activeProjection =
    options?.activeProjection ??
    rendererAdapter.getProjectionAdapter().getProjection();
  const projectionControls = Array.isArray(options?.projectionControls)
    ? options.projectionControls
    : buildWorldProjectionControls(
        caps,
        projectionPreference,
        activeProjection
      );
  const roadDetail = options?.roadDetail ?? "medium";
  const roadDetailControls = Array.isArray(options?.roadDetailControls)
    ? options.roadDetailControls
    : [];
  const buildingsMode = options?.buildingsMode ?? "2d";
  const effectiveBuildingsMode = options?.effectiveBuildingsMode ?? "off";
  const buildingsControls = Array.isArray(options?.buildingsControls)
    ? options.buildingsControls
    : [];
  const placeSheet = options?.placeSheet ?? null;
  const educationSheet = options?.educationSheet ?? null;
  const userSheet = options?.userSheet ?? null;
  const gameSheet = options?.gameSheet ?? null;
  const commerceSheet = options?.commerceSheet ?? null;
  const eventSheet = options?.eventSheet ?? null;

  if (loading) {
    return {
      phase: "loading",
      message: "Loading World…",
      errorMessage: null,
      rendererBound,
      foundationConfigured,
      layers: buildWorldLayerControls(snapshot, selection.selectedCategories),
      placeLayers,
      mapSources,
      projectionControls,
      activeProjection,
      projectionPreference,
      roadDetailControls,
      roadDetail,
      buildingsControls,
      buildingsMode,
      effectiveBuildingsMode,
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
      eventSheet: null,
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
      mapSources,
      projectionControls,
      activeProjection,
      projectionPreference,
      roadDetailControls,
      roadDetail,
      buildingsControls,
      buildingsMode,
      effectiveBuildingsMode,
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
      eventSheet: null,
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
    mapSources,
    projectionControls,
    activeProjection,
    projectionPreference,
    roadDetailControls,
    roadDetail,
    buildingsControls,
    buildingsMode,
    effectiveBuildingsMode,
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
    eventSheet,
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
