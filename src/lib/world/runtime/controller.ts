import {
  buildWorldExperienceViewState,
  createDefaultWorldUiSelection,
  selectWorldEntity,
  toggleWorldCategorySelection,
  WORLD_RETRY_YIELD_MS,
  type WorldCameraControlId,
  type WorldExperienceViewState,
  type WorldUiSelectionState,
} from "@/src/lib/world/experience";
import type { WorldCategoryId, WorldFoundationSnapshot } from "@/src/lib/world/types";
import {
  createDefaultMapSourceRegistry,
  isWorldMapSourceAvailable,
  type MapSourceRegistry,
  type WorldMapSource,
} from "@/src/lib/world/mapSource";
import {
  buildPlaceLayerControls,
  buildWorldPlaceSheetState,
  createDemoPlaceProvider,
  createPlaceRegistry,
  createUnboundPlaceProvider,
  createWorldPlacesLayerDefinition,
  defaultSelectedPlaceLayers,
  filterMarkersByPlaceLayers,
  isWorldPlaceProviderAvailable,
  togglePlaceLayerSelection,
  WORLD_PLACES_LAYER_ID,
  worldPlacesToEntities,
  worldPlacesToMarkers,
  type PlaceRegistry,
  type WorldPlaceLayerId,
  type WorldPlaceProvider,
} from "@/src/lib/world/places";
import {
  createMapLibreRendererAdapter,
  createNullRendererAdapter,
  isMapLibreRendererAdapter,
  isRendererAdapterBound,
  type WorldRendererAdapter,
} from "@/src/lib/world/renderer";
import {
  createUnboundWorldDataSource,
  isWorldDataSourceBound,
} from "@/src/lib/world/runtime/dataSource";
import {
  canTransitionWorldRuntimePhase,
  resolveWorldRuntimePhaseAfterLoad,
  worldRuntimePhaseMessage,
} from "@/src/lib/world/runtime/stateMachine";
import type {
  WorldDataSource,
  WorldRuntimeControllerOptions,
  WorldRuntimePhase,
  WorldRuntimeState,
} from "@/src/lib/world/runtime/types";

type Listener = () => void;

const MAP_SOURCE_UNAVAILABLE_MESSAGE =
  "World map source is unavailable. No map imagery can be shown.";

function initialRuntimeState(
  rendererBound: boolean,
  mapSourceBound: boolean,
  placeProviderBound: boolean
): WorldRuntimeState {
  return {
    phase: "preparing",
    message: worldRuntimePhaseMessage("preparing"),
    errorMessage: null,
    snapshot: null,
    attempt: 0,
    dataSourceBound: false,
    rendererBound,
    mapSourceBound,
    placeProviderBound,
  };
}

function resolveMapSource(
  registry: MapSourceRegistry,
  preferredId?: string | null
): WorldMapSource | null {
  return registry.resolve(preferredId);
}

function createRendererFromMapSource(
  mapSource: WorldMapSource | null
): WorldRendererAdapter {
  if (!isWorldMapSourceAvailable(mapSource)) {
    return createNullRendererAdapter();
  }
  const styleUrl = mapSource!.getStyleUrl();
  if (!styleUrl) {
    return createNullRendererAdapter();
  }
  return createMapLibreRendererAdapter({ styleUrl });
}

function mergePlacesIntoSnapshot(
  snapshot: WorldFoundationSnapshot,
  placesBound: boolean
): WorldFoundationSnapshot {
  if (!placesBound) return snapshot;
  const hasCitiesLayer = snapshot.layers.some(
    (layer) => layer.category === "cities"
  );
  if (hasCitiesLayer) return snapshot;
  return {
    ...snapshot,
    layers: [...snapshot.layers, createWorldPlacesLayerDefinition()],
  };
}

/**
 * Sole runtime authority for UM World operational state + renderer slot.
 * Screen UI must consume this controller — not invent parallel load/render logic.
 * Map style selection is exclusively via MapSourceRegistry → WorldMapSource.
 * Places load exclusively via WorldPlaceProvider → PlaceRegistry → Renderer.
 */
export class WorldRuntimeController {
  private dataSource: WorldDataSource;
  private renderer: WorldRendererAdapter;
  private mapSourceRegistry: MapSourceRegistry;
  private mapSource: WorldMapSource | null;
  private placeProvider: WorldPlaceProvider;
  private placeRegistry: PlaceRegistry;
  private yieldMs: number;
  private state: WorldRuntimeState;
  private selection: WorldUiSelectionState = createDefaultWorldUiSelection();
  private listeners = new Set<Listener>();
  private runToken = 0;
  private started = false;

  constructor(options?: WorldRuntimeControllerOptions) {
    this.dataSource = options?.dataSource ?? createUnboundWorldDataSource();
    this.mapSourceRegistry =
      options?.mapSourceRegistry ?? createDefaultMapSourceRegistry();
    this.mapSource = resolveMapSource(
      this.mapSourceRegistry,
      options?.mapSourceId
    );
    const mapSourceBound = isWorldMapSourceAvailable(this.mapSource);

    if (options?.placeProvider === null) {
      this.placeProvider = createUnboundPlaceProvider();
    } else {
      this.placeProvider =
        options?.placeProvider ?? createDemoPlaceProvider();
    }
    this.placeRegistry = createPlaceRegistry();
    const placeProviderBound = isWorldPlaceProviderAvailable(this.placeProvider);

    if (options?.renderer !== undefined) {
      this.renderer = options.renderer ?? createNullRendererAdapter();
    } else {
      this.renderer = createRendererFromMapSource(this.mapSource);
    }

    this.yieldMs =
      typeof options?.yieldMs === "number" && options.yieldMs >= 0
        ? options.yieldMs
        : WORLD_RETRY_YIELD_MS;
    this.state = initialRuntimeState(
      isRendererAdapterBound(this.renderer),
      mapSourceBound,
      placeProviderBound
    );
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getRuntimeState(): WorldRuntimeState {
    return { ...this.state };
  }

  /** Only access path for renderer — UI must not bind engines directly. */
  getRendererAdapter(): WorldRendererAdapter {
    return this.renderer;
  }

  /**
   * Selected map source (Runtime / tests).
   * UI must not consume this — attribution flows through view state only.
   */
  getSelectedMapSource(): WorldMapSource | null {
    return this.mapSource;
  }

  /** Place registry (Runtime / tests) — UI must not import places modules. */
  getPlaceRegistry(): PlaceRegistry {
    return this.placeRegistry;
  }

  getSelection(): WorldUiSelectionState {
    return {
      ...this.selection,
      selectedCategories: [...this.selection.selectedCategories],
      selectedPlaceLayers: [
        ...(this.selection.selectedPlaceLayers ?? defaultSelectedPlaceLayers()),
      ],
    };
  }

  getViewState(): WorldExperienceViewState {
    const runtime = this.state;
    const loading =
      runtime.phase === "preparing" || runtime.phase === "loading";
    const attribution =
      isWorldMapSourceAvailable(this.mapSource) && this.mapSource
        ? this.mapSource.getAttribution()
        : undefined;
    const placesBound = isWorldPlaceProviderAvailable(this.placeProvider);
    const rawSnapshot = runtime.snapshot ?? undefined;
    const snapshot = rawSnapshot
      ? mergePlacesIntoSnapshot(rawSnapshot, placesBound)
      : undefined;
    const entities = placesBound
      ? worldPlacesToEntities(this.placeRegistry.listCities())
      : [];
    const placeLayers = buildPlaceLayerControls(
      this.selection.selectedPlaceLayers ?? defaultSelectedPlaceLayers(),
      placesBound
    );
    const selectedPlace =
      this.selection.selectedEntityId != null
        ? this.placeRegistry.get(this.selection.selectedEntityId)
        : null;
    const placeSheet = buildWorldPlaceSheetState(
      selectedPlace,
      this.selection.placeSheetOpen === true && selectedPlace != null
    );

    const base = buildWorldExperienceViewState({
      snapshot,
      selection: this.selection,
      loading,
      errorMessage: runtime.phase === "error" ? runtime.errorMessage : null,
      rendererAdapter: this.renderer,
      attribution,
      entities,
      placeLayers,
      placeSheet,
    });

    if (runtime.phase === "preparing") {
      return {
        ...base,
        phase: "preparing",
        message: worldRuntimePhaseMessage("preparing"),
        rendererBound: runtime.rendererBound,
      };
    }
    if (runtime.phase === "loading") {
      return {
        ...base,
        phase: "loading",
        message: worldRuntimePhaseMessage("loading"),
        rendererBound: runtime.rendererBound,
      };
    }
    if (runtime.phase === "ready") {
      return {
        ...base,
        phase: "ready",
        message: worldRuntimePhaseMessage("ready", runtime.snapshot?.message),
        rendererBound: runtime.rendererBound,
      };
    }
    if (runtime.phase === "error") {
      return {
        ...base,
        phase: "error",
        errorMessage: runtime.errorMessage,
        message: worldRuntimePhaseMessage("error"),
        rendererBound: runtime.rendererBound,
      };
    }
    return {
      ...base,
      phase: "unavailable",
      message: worldRuntimePhaseMessage(
        "unavailable",
        !runtime.mapSourceBound
          ? MAP_SOURCE_UNAVAILABLE_MESSAGE
          : (runtime.snapshot?.message ?? base.message)
      ),
      rendererBound: runtime.rendererBound,
    };
  }

  /** Begin runtime — preparing → loading → terminal phase. */
  async start(): Promise<void> {
    if (!this.started) {
      this.started = true;
      this.setPhase("preparing");
      try {
        this.renderer.mount();
      } catch {
        // Fail-closed: null/broken adapters must not crash Runtime.
      }
      this.bindPlacePressHandler();
    }
    await this.runLoadCycle();
  }

  /** Retry must go through the controller only. */
  async retry(): Promise<void> {
    this.setPhase(
      this.state.phase === "preparing" ? "preparing" : "loading"
    );
    try {
      this.renderer.mount();
    } catch {
      // Fail-closed.
    }
    this.bindPlacePressHandler();
    await this.runLoadCycle();
  }

  /**
   * Camera gestures from UI — always routed through Runtime → CameraAdapter.
   * Returns false when the renderer rejects the request (fail-closed).
   */
  applyCameraControl(id: WorldCameraControlId): boolean {
    const camera = this.renderer.getCameraAdapter();
    let ok = false;
    switch (id) {
      case "zoom_in":
        ok = camera.zoomIn();
        break;
      case "zoom_out":
        ok = camera.zoomOut();
        break;
      case "recenter":
        ok = camera.recenter();
        break;
      case "reset_orientation":
        ok = camera.resetOrientation();
        break;
      default:
        ok = false;
    }
    if (ok) this.emit();
    return ok;
  }

  /** Select a place/entity — used by renderer place press via Runtime handler. */
  selectPlace(placeId: string | null): boolean {
    if (!placeId) {
      this.selection = {
        ...selectWorldEntity(this.selection, null),
        placeSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedPlaceMarker();
      }
      this.syncPlacesToRenderer();
      this.emit();
      return true;
    }
    const place = this.placeRegistry.get(placeId);
    if (!place) return false;
    this.selection = {
      ...selectWorldEntity(this.selection, place.id),
      placeSheetOpen: true,
    };
    this.syncPlacesToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.setSelectedPlaceMarkerId(place.id);
      this.renderer.focusPlaceAt(place.latitude, place.longitude);
    }
    this.emit();
    return true;
  }

  togglePlaceLayer(layerId: WorldPlaceLayerId): void {
    const current =
      this.selection.selectedPlaceLayers ?? defaultSelectedPlaceLayers();
    this.selection = {
      ...this.selection,
      selectedPlaceLayers: togglePlaceLayerSelection(current, layerId),
    };
    // Keep cities category in sync when any place sub-layer is active.
    const anyActive = this.selection.selectedPlaceLayers.length > 0;
    const cats = this.selection.selectedCategories.filter((c) => c !== "cities");
    this.selection = {
      ...this.selection,
      selectedCategories: anyActive ? [...cats, "cities"] : cats,
    };
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_PLACES_LAYER_ID, anyActive);
    this.syncPlacesToRenderer();
    this.emit();
  }

  toggleLayer(categoryId: WorldCategoryId, enabled: boolean): void {
    this.selection = {
      ...this.selection,
      selectedCategories: toggleWorldCategorySelection(
        this.selection.selectedCategories,
        categoryId,
        enabled
      ),
    };
    const visible = this.selection.selectedCategories.includes(categoryId);
    this.renderer.getLayerAdapter().setLayerVisibility(categoryId, visible);
    if (categoryId === "cities") {
      this.selection = {
        ...this.selection,
        selectedPlaceLayers: visible
          ? defaultSelectedPlaceLayers()
          : [],
      };
    }
    this.syncPlacesToRenderer();
    this.emit();
  }

  toggleFiltersPanel(): void {
    this.selection = {
      ...this.selection,
      filterPanelOpen: !this.selection.filterPanelOpen,
    };
    this.emit();
  }

  toggleLayersPanel(): void {
    this.selection = {
      ...this.selection,
      layersPanelOpen: !this.selection.layersPanelOpen,
    };
    this.emit();
  }

  clearFilters(): void {
    this.selection = {
      ...this.selection,
      selectedCategories: [],
      selectedPlaceLayers: [],
    };
    this.renderer.getLayerAdapter().setLayerVisibility(WORLD_PLACES_LAYER_ID, false);
    this.syncPlacesToRenderer();
    this.emit();
  }

  closeFilters(): void {
    this.selection = {
      ...this.selection,
      filterPanelOpen: false,
    };
    this.emit();
  }

  closeDetails(): void {
    this.selection = {
      ...this.selection,
      selectedEntityId: null,
      detailsOpen: false,
      placeSheetOpen: false,
    };
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
    }
    this.syncPlacesToRenderer();
    this.emit();
  }

  private bindPlacePressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setPlacePressHandler((placeId) => {
      this.selectPlace(placeId);
    });
  }

  private syncPlacesToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const placesBound = isWorldPlaceProviderAvailable(this.placeProvider);
    if (!placesBound) {
      this.renderer.setPlaceMarkers([]);
      this.renderer.getLayerAdapter().setLayerVisibility(WORLD_PLACES_LAYER_ID, false);
      return;
    }
    const activeLayers =
      this.selection.selectedPlaceLayers ?? defaultSelectedPlaceLayers();
    const citiesVisible =
      activeLayers.length > 0 &&
      this.selection.selectedCategories.includes(WORLD_PLACES_LAYER_ID);
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_PLACES_LAYER_ID, citiesVisible);
    const allMarkers = worldPlacesToMarkers(this.placeRegistry.listCities());
    this.renderer.setPlaceMarkers(
      citiesVisible
        ? filterMarkersByPlaceLayers(allMarkers, activeLayers)
        : []
    );
  }

  private async loadPlaces(): Promise<void> {
    this.placeRegistry.clear();
    if (!isWorldPlaceProviderAvailable(this.placeProvider)) {
      this.syncPlacesToRenderer();
      return;
    }
    try {
      const places = await this.placeProvider.listPlaces();
      const accepted = this.placeRegistry.registerAll(
        Array.isArray(places) ? places : []
      );
      if (accepted > 0) {
        if (!this.selection.selectedCategories.includes(WORLD_PLACES_LAYER_ID)) {
          this.selection = {
            ...this.selection,
            selectedCategories: [
              ...this.selection.selectedCategories,
              WORLD_PLACES_LAYER_ID,
            ],
            selectedPlaceLayers: defaultSelectedPlaceLayers(),
          };
        } else if (
          !this.selection.selectedPlaceLayers ||
          this.selection.selectedPlaceLayers.length === 0
        ) {
          this.selection = {
            ...this.selection,
            selectedPlaceLayers: defaultSelectedPlaceLayers(),
          };
        }
      }
    } catch {
      this.placeRegistry.clear();
    }
    this.syncPlacesToRenderer();
  }

  private async runLoadCycle(): Promise<void> {
    const token = ++this.runToken;
    const dataBound = isWorldDataSourceBound(this.dataSource);
    const mapSourceBound = isWorldMapSourceAvailable(this.mapSource);
    const placeProviderBound = isWorldPlaceProviderAvailable(this.placeProvider);
    const rendererBound = isRendererAdapterBound(this.renderer);

    this.state = {
      ...this.state,
      phase: "loading",
      message: worldRuntimePhaseMessage("loading"),
      errorMessage: null,
      attempt: this.state.attempt + 1,
      dataSourceBound: dataBound,
      rendererBound,
      mapSourceBound,
      placeProviderBound,
    };
    this.emit();

    if (this.yieldMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.yieldMs);
      });
    }
    if (token !== this.runToken) return;

    await this.loadPlaces();
    if (token !== this.runToken) return;

    try {
      const snapshot = await this.dataSource.loadSnapshot();
      if (token !== this.runToken) return;

      let phase = resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: dataBound,
        snapshot,
        errorMessage: null,
      });

      if (!mapSourceBound && phase !== "error") {
        phase = "unavailable";
      }

      this.state = {
        phase,
        message: worldRuntimePhaseMessage(
          phase,
          !mapSourceBound && phase === "unavailable"
            ? MAP_SOURCE_UNAVAILABLE_MESSAGE
            : snapshot.message
        ),
        errorMessage: phase === "error" ? snapshot.message : null,
        snapshot,
        attempt: this.state.attempt,
        dataSourceBound: dataBound,
        rendererBound,
        mapSourceBound,
        placeProviderBound,
      };
      this.selection = {
        ...this.selection,
        selectedEntityId: null,
        detailsOpen: false,
        placeSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedPlaceMarker();
      }
      this.emit();
    } catch (err) {
      if (token !== this.runToken) return;
      const message =
        err instanceof Error ? err.message : "Unable to load World.";
      this.state = {
        phase: "error",
        message: worldRuntimePhaseMessage("error"),
        errorMessage: message,
        snapshot: null,
        attempt: this.state.attempt,
        dataSourceBound: dataBound,
        rendererBound,
        mapSourceBound,
        placeProviderBound,
      };
      this.emit();
    }
  }

  private setPhase(phase: WorldRuntimePhase): void {
    const mapSourceBound = isWorldMapSourceAvailable(this.mapSource);
    const placeProviderBound = isWorldPlaceProviderAvailable(this.placeProvider);
    if (!canTransitionWorldRuntimePhase(this.state.phase, phase)) {
      if (phase === "loading" || phase === "preparing") {
        this.state = {
          ...this.state,
          phase,
          message: worldRuntimePhaseMessage(phase),
          errorMessage: null,
          rendererBound: isRendererAdapterBound(this.renderer),
          mapSourceBound,
          placeProviderBound,
        };
        this.emit();
      }
      return;
    }
    this.state = {
      ...this.state,
      phase,
      message: worldRuntimePhaseMessage(phase),
      errorMessage: phase === "error" ? this.state.errorMessage : null,
      rendererBound: isRendererAdapterBound(this.renderer),
      mapSourceBound,
      placeProviderBound,
    };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createWorldRuntimeController(
  options?: WorldRuntimeControllerOptions
): WorldRuntimeController {
  return new WorldRuntimeController(options);
}
