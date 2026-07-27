import {
  buildWorldExperienceViewState,
  buildWorldMapSourceControls,
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
  DEMO_MAP_SOURCE_ID,
  isWorldMapSourceAvailable,
  type MapSourceRegistry,
  type WorldMapSource,
  type WorldMapSourceKind,
} from "@/src/lib/world/mapSource";
import {
  createDefaultWorldDataPipeline,
  createEmptyWorldDataPipeline,
  type WorldDataBundle,
  type WorldDataPipeline,
} from "@/src/lib/world/dataPipeline";
import {
  buildWorldEducationSheetState,
  createEducationRegistry,
  createWorldEducationLayerDefinition,
  WORLD_EDUCATION_LAYER_ID,
  worldEducationToEntities,
  worldEducationToMarkers,
  type EducationRegistry,
} from "@/src/lib/world/education";
import {
  buildWorldUserSheetState,
  createUsersRegistry,
  createWorldUsersLayerDefinition,
  WORLD_USERS_LAYER_ID,
  worldUsersToEntities,
  worldUsersToMarkers,
  type UsersRegistry,
} from "@/src/lib/world/users";
import {
  buildWorldGameSheetState,
  createGamesRegistry,
  createWorldGamesLayerDefinition,
  WORLD_GAMES_LAYER_ID,
  worldGamesToEntities,
  worldGamesToMarkers,
  type GamesRegistry,
} from "@/src/lib/world/games";
import {
  buildWorldCommerceSheetState,
  createCommerceRegistry,
  createWorldCommerceLayerDefinition,
  WORLD_COMMERCE_LAYER_ID,
  worldCommerceToEntities,
  worldCommerceToMarkers,
  type CommerceRegistry,
} from "@/src/lib/world/commerce";
import {
  buildWorldEventSheetState,
  createEventsRegistry,
  createWorldEventsLayerDefinition,
  WORLD_EVENTS_LAYER_ID,
  worldEventsToEntities,
  worldEventsToMarkers,
  type EventsRegistry,
} from "@/src/lib/world/events";
import {
  buildPlaceLayerControls,
  buildWorldPlaceSheetState,
  createPlaceRegistry,
  createWorldPlacesLayerDefinition,
  defaultSelectedPlaceLayers,
  filterMarkersByPlaceLayers,
  togglePlaceLayerSelection,
  WORLD_PLACES_LAYER_ID,
  worldPlacesToEntities,
  worldPlacesToMarkers,
  type PlaceRegistry,
  type WorldPlaceLayerId,
} from "@/src/lib/world/places";
import {
  buildWorldSearchDataset,
  createWorldSearchService,
  type WorldSearchResult,
  type WorldSearchService,
} from "@/src/lib/world/search";
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

function mergeEducationIntoSnapshot(
  snapshot: WorldFoundationSnapshot,
  educationBound: boolean
): WorldFoundationSnapshot {
  if (!educationBound) return snapshot;
  const hasEducationLayer = snapshot.layers.some(
    (layer) => layer.category === "education"
  );
  if (hasEducationLayer) return snapshot;
  return {
    ...snapshot,
    layers: [...snapshot.layers, createWorldEducationLayerDefinition()],
  };
}

function mergeUsersIntoSnapshot(
  snapshot: WorldFoundationSnapshot,
  usersBound: boolean
): WorldFoundationSnapshot {
  if (!usersBound) return snapshot;
  const hasUsersLayer = snapshot.layers.some(
    (layer) => layer.category === "users"
  );
  if (hasUsersLayer) return snapshot;
  return {
    ...snapshot,
    layers: [...snapshot.layers, createWorldUsersLayerDefinition()],
  };
}

function mergeGamesIntoSnapshot(
  snapshot: WorldFoundationSnapshot,
  gamesBound: boolean
): WorldFoundationSnapshot {
  if (!gamesBound) return snapshot;
  const hasGamesLayer = snapshot.layers.some((layer) => layer.category === "games");
  if (hasGamesLayer) return snapshot;
  return {
    ...snapshot,
    layers: [...snapshot.layers, createWorldGamesLayerDefinition()],
  };
}

function mergeCommerceIntoSnapshot(
  snapshot: WorldFoundationSnapshot,
  commerceBound: boolean
): WorldFoundationSnapshot {
  if (!commerceBound) return snapshot;
  const hasCommerceLayer = snapshot.layers.some(
    (layer) => layer.category === "businesses"
  );
  if (hasCommerceLayer) return snapshot;
  return {
    ...snapshot,
    layers: [...snapshot.layers, createWorldCommerceLayerDefinition()],
  };
}

function mergeEventsIntoSnapshot(
  snapshot: WorldFoundationSnapshot,
  eventsBound: boolean
): WorldFoundationSnapshot {
  if (!eventsBound) return snapshot;
  const hasEventsLayer = snapshot.layers.some((layer) => layer.category === "events");
  if (hasEventsLayer) return snapshot;
  return {
    ...snapshot,
    layers: [...snapshot.layers, createWorldEventsLayerDefinition()],
  };
}

/**
 * Screen UI must consume this controller — not invent parallel load/render logic.
 * Map style selection is exclusively via MapSourceRegistry → WorldMapSource.
 * Domain data loads exclusively via WorldDataPipeline → registries / Renderer.
 */
export class WorldRuntimeController {
  private dataSource: WorldDataSource;
  private dataPipeline: WorldDataPipeline;
  private searchService: WorldSearchService;
  private lastDataBundle: WorldDataBundle | null = null;
  private renderer: WorldRendererAdapter;
  private mapSourceRegistry: MapSourceRegistry;
  private mapSource: WorldMapSource | null;
  private placeRegistry: PlaceRegistry;
  private educationRegistry: EducationRegistry;
  private usersRegistry: UsersRegistry;
  private gamesRegistry: GamesRegistry;
  private commerceRegistry: CommerceRegistry;
  private eventsRegistry: EventsRegistry;
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

    if (options?.dataPipeline === null) {
      this.dataPipeline = createEmptyWorldDataPipeline();
    } else if (options?.dataPipeline) {
      this.dataPipeline = options.dataPipeline;
    } else {
      this.dataPipeline = createDefaultWorldDataPipeline({
        placeProvider: options?.placeProvider,
      });
    }
    this.placeRegistry = createPlaceRegistry();
    this.educationRegistry = createEducationRegistry();
    this.usersRegistry = createUsersRegistry();
    this.gamesRegistry = createGamesRegistry();
    this.commerceRegistry = createCommerceRegistry();
    this.eventsRegistry = createEventsRegistry();
    this.searchService = createWorldSearchService();
    const placeProviderBound = this.dataPipeline.isKindAvailable("places");

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

  /** Data pipeline (Runtime / tests) — UI must not import providers. */
  getDataPipeline(): WorldDataPipeline {
    return this.dataPipeline;
  }

  /** Last pipeline bundle (Runtime / tests). */
  getLastDataBundle(): WorldDataBundle | null {
    return this.lastDataBundle;
  }

  /** Education registry (Runtime / tests). */
  getEducationRegistry(): EducationRegistry {
    return this.educationRegistry;
  }

  /** Users registry (Runtime / tests). */
  getUsersRegistry(): UsersRegistry {
    return this.usersRegistry;
  }

  /** Games registry (Runtime / tests). */
  getGamesRegistry(): GamesRegistry {
    return this.gamesRegistry;
  }

  /** Commerce registry (Runtime / tests). */
  getCommerceRegistry(): CommerceRegistry {
    return this.commerceRegistry;
  }

  /** Events registry (Runtime / tests). */
  getEventsRegistry(): EventsRegistry {
    return this.eventsRegistry;
  }

  /**
   * Unified World search — UI → Runtime → WorldSearchService over Pipeline-backed registries.
   * Empty query → []. Missing provider kinds are omitted (fail-closed).
   */
  searchWorld(query: string): WorldSearchResult[] {
    try {
      const dataset = buildWorldSearchDataset({
        placesAvailable: this.dataPipeline.isKindAvailable("places"),
        educationAvailable: this.dataPipeline.isKindAvailable("education"),
        usersAvailable: this.dataPipeline.isKindAvailable("users"),
        gamesAvailable: this.dataPipeline.isKindAvailable("games"),
        commerceAvailable: this.dataPipeline.isKindAvailable("commerce"),
        eventsAvailable: this.dataPipeline.isKindAvailable("events"),
        places: this.placeRegistry.list(),
        education: this.educationRegistry.list(),
        users: this.usersRegistry.list(),
        games: this.gamesRegistry.list(),
        commerce: this.commerceRegistry.list(),
        events: this.eventsRegistry.list(),
      });
      return this.searchService.search(query, dataset);
    } catch {
      return [];
    }
  }

  /** Select a search hit — routes to Place, Education, or User sheet + camera focus. */
  selectSearchResult(result: WorldSearchResult): boolean {
    if (!result || typeof result.id !== "string") return false;
    if (result.sourceType === "places") {
      return this.selectPlace(result.id);
    }
    if (result.sourceType === "education") {
      return this.selectEducation(result.id);
    }
    if (result.sourceType === "users") {
      return this.selectUser(result.id);
    }
    if (result.sourceType === "games") {
      return this.selectGame(result.id);
    }
    if (result.sourceType === "commerce") {
      return this.selectCommerce(result.id);
    }
    if (result.sourceType === "events") {
      return this.selectEvent(result.id);
    }
    return false;
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
    const placesBound = this.dataPipeline.isKindAvailable("places");
    const educationBound = this.dataPipeline.isKindAvailable("education");
    const usersBound = this.dataPipeline.isKindAvailable("users");
    const gamesBound = this.dataPipeline.isKindAvailable("games");
    const commerceBound = this.dataPipeline.isKindAvailable("commerce");
    const eventsBound = this.dataPipeline.isKindAvailable("events");
    const rawSnapshot = runtime.snapshot ?? undefined;
    let snapshot = rawSnapshot
      ? mergePlacesIntoSnapshot(rawSnapshot, placesBound)
      : undefined;
    if (snapshot) {
      snapshot = mergeEducationIntoSnapshot(snapshot, educationBound);
    }
    if (snapshot) {
      snapshot = mergeUsersIntoSnapshot(snapshot, usersBound);
    }
    if (snapshot) {
      snapshot = mergeGamesIntoSnapshot(snapshot, gamesBound);
    }
    if (snapshot) {
      snapshot = mergeCommerceIntoSnapshot(snapshot, commerceBound);
    }
    if (snapshot) {
      snapshot = mergeEventsIntoSnapshot(snapshot, eventsBound);
    }
    const placeEntities = placesBound
      ? worldPlacesToEntities(this.placeRegistry.listCities())
      : [];
    const educationEntities = educationBound
      ? worldEducationToEntities(this.educationRegistry.listMappable())
      : [];
    const userEntities = usersBound
      ? worldUsersToEntities(this.usersRegistry.listMappable())
      : [];
    const gameEntities = gamesBound
      ? worldGamesToEntities(this.gamesRegistry.listMappable())
      : [];
    const commerceEntities = commerceBound
      ? worldCommerceToEntities(this.commerceRegistry.listMappable())
      : [];
    const eventEntities = eventsBound
      ? worldEventsToEntities(this.eventsRegistry.listMappable())
      : [];
    const entities = [
      ...placeEntities,
      ...educationEntities,
      ...userEntities,
      ...gameEntities,
      ...commerceEntities,
      ...eventEntities,
    ];
    const placeLayers = buildPlaceLayerControls(
      this.selection.selectedPlaceLayers ?? defaultSelectedPlaceLayers(),
      placesBound
    );
    const selectedPlace =
      this.selection.selectedEntityId != null &&
      this.selection.placeSheetOpen === true
        ? this.placeRegistry.get(this.selection.selectedEntityId)
        : null;
    const placeSheet = buildWorldPlaceSheetState(
      selectedPlace,
      this.selection.placeSheetOpen === true && selectedPlace != null
    );
    const selectedEducation =
      this.selection.selectedEntityId != null &&
      this.selection.educationSheetOpen === true
        ? this.educationRegistry.get(this.selection.selectedEntityId)
        : null;
    const educationSheet = buildWorldEducationSheetState(
      selectedEducation,
      this.selection.educationSheetOpen === true && selectedEducation != null
    );
    const selectedUser =
      this.selection.selectedEntityId != null &&
      this.selection.userSheetOpen === true
        ? this.usersRegistry.get(this.selection.selectedEntityId)
        : null;
    const userSheet = buildWorldUserSheetState(
      selectedUser,
      this.selection.userSheetOpen === true && selectedUser != null
    );
    const selectedGame =
      this.selection.selectedEntityId != null &&
      this.selection.gameSheetOpen === true
        ? this.gamesRegistry.get(this.selection.selectedEntityId)
        : null;
    const gameSheet = buildWorldGameSheetState(
      selectedGame,
      this.selection.gameSheetOpen === true && selectedGame != null
    );
    const selectedCommerce =
      this.selection.selectedEntityId != null &&
      this.selection.commerceSheetOpen === true
        ? this.commerceRegistry.get(this.selection.selectedEntityId)
        : null;
    const commerceSheet = buildWorldCommerceSheetState(
      selectedCommerce,
      this.selection.commerceSheetOpen === true && selectedCommerce != null
    );
    const selectedEvent =
      this.selection.selectedEntityId != null &&
      this.selection.eventSheetOpen === true
        ? this.eventsRegistry.get(this.selection.selectedEntityId)
        : null;
    const eventSheet = buildWorldEventSheetState(
      selectedEvent,
      this.selection.eventSheetOpen === true && selectedEvent != null
    );

    const switchableSources = this.mapSourceRegistry
      .list()
      .filter(
        (s) =>
          s.kind === "street" || s.kind === "satellite" || s.kind === "terrain"
      )
      .map((s) => ({
        id: s.id,
        label: s.label,
        kind: s.kind,
        enabled: isWorldMapSourceAvailable(s),
      }));
    const mapSources = buildWorldMapSourceControls(
      switchableSources,
      this.mapSource?.id ?? null
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
      educationSheet,
      userSheet,
      gameSheet,
      commerceSheet,
      eventSheet,
      mapSources,
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
      this.bindEducationPressHandler();
      this.bindUserPressHandler();
      this.bindGamePressHandler();
      this.bindCommercePressHandler();
      this.bindEventPressHandler();
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
    this.bindEducationPressHandler();
    this.bindUserPressHandler();
    this.bindGamePressHandler();
    this.bindCommercePressHandler();
    this.bindEventPressHandler();
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

  /**
   * Switch map source without full Runtime reinit — preserves camera, selection, layers.
   * Fail-closed: unavailable preferred id falls back to Demo.
   */
  setMapSourceId(sourceId: string): boolean {
    if (!sourceId || typeof sourceId !== "string") return false;
    const trimmed = sourceId.trim();
    if (trimmed.length === 0) return false;

    let next = this.mapSourceRegistry.resolve(trimmed);
    if (!isWorldMapSourceAvailable(next)) {
      next = this.mapSourceRegistry.resolve(DEMO_MAP_SOURCE_ID);
    }
    if (!isWorldMapSourceAvailable(next)) {
      return false;
    }

    if (
      next!.kind === "terrain" &&
      !this.renderer.getCapabilities().supportsTerrain
    ) {
      next = this.mapSourceRegistry.resolve(DEMO_MAP_SOURCE_ID);
      if (!isWorldMapSourceAvailable(next)) {
        return false;
      }
    }

    if (this.mapSource?.id === next!.id) {
      return true;
    }

    let styleUrl = next!.getStyleUrl();
    if (!styleUrl) {
      const demo = this.mapSourceRegistry.resolve(DEMO_MAP_SOURCE_ID);
      if (!isWorldMapSourceAvailable(demo)) return false;
      next = demo;
      styleUrl = demo!.getStyleUrl();
      if (!styleUrl) return false;
    }

    this.mapSource = next!;

    if (isMapLibreRendererAdapter(this.renderer)) {
      if (!this.renderer.setStyleUrl(styleUrl)) {
        const demo = this.mapSourceRegistry.resolve(DEMO_MAP_SOURCE_ID);
        const demoUrl = demo?.getStyleUrl();
        if (!isWorldMapSourceAvailable(demo) || !demoUrl) {
          return false;
        }
        this.mapSource = demo!;
        if (!this.renderer.setStyleUrl(demoUrl)) {
          return false;
        }
      }
      this.bindPlacePressHandler();
      this.bindEducationPressHandler();
      this.bindUserPressHandler();
      this.bindGamePressHandler();
      this.bindCommercePressHandler();
      this.bindEventPressHandler();
      this.syncAllLayersToRenderer();
      if (next!.kind === "terrain") {
        this.renderer.setTerrainEnabled(true);
      } else {
        this.renderer.setTerrainEnabled(false);
      }
    }

    this.state = {
      ...this.state,
      mapSourceBound: isWorldMapSourceAvailable(this.mapSource),
      rendererBound: isRendererAdapterBound(this.renderer),
    };
    this.emit();
    return true;
  }

  /** Switch by map source kind — street, satellite, or terrain. */
  setMapSourceKind(
    kind: Extract<WorldMapSourceKind, "street" | "satellite" | "terrain">
  ): boolean {
    const match = this.mapSourceRegistry.list().find((s) => s.kind === kind);
    if (!match) return false;
    return this.setMapSourceId(match.id);
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
      educationSheetOpen: false,
      userSheetOpen: false,
      gameSheetOpen: false,
      commerceSheetOpen: false,
      eventSheetOpen: false,
    };
    this.syncPlacesToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedEducationMarker();
      this.renderer.clearSelectedUserMarker();
      this.renderer.clearSelectedGameMarker();
      this.renderer.clearSelectedCommerceMarker();
      this.renderer.clearSelectedEventMarker();
      this.renderer.setSelectedPlaceMarkerId(place.id);
      this.renderer.focusPlaceAt(place.latitude, place.longitude);
    }
    this.emit();
    return true;
  }

  /** Select an education node — used by renderer education press via Runtime. */
  selectEducation(educationId: string | null): boolean {
    if (!educationId) {
      this.selection = {
        ...selectWorldEntity(this.selection, null),
        educationSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedEducationMarker();
      }
      this.syncEducationToRenderer();
      this.emit();
      return true;
    }
    const record = this.educationRegistry.get(educationId);
    if (!record) return false;
    if (
      typeof record.latitude !== "number" ||
      typeof record.longitude !== "number"
    ) {
      return false;
    }
    this.selection = {
      ...selectWorldEntity(this.selection, record.id),
      educationSheetOpen: true,
      placeSheetOpen: false,
      userSheetOpen: false,
      gameSheetOpen: false,
      commerceSheetOpen: false,
      eventSheetOpen: false,
    };
    this.syncEducationToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
      this.renderer.clearSelectedUserMarker();
      this.renderer.clearSelectedGameMarker();
      this.renderer.clearSelectedCommerceMarker();
      this.renderer.clearSelectedEventMarker();
      this.renderer.setSelectedEducationMarkerId(record.id);
      this.renderer.focusPlaceAt(record.latitude, record.longitude);
    }
    this.emit();
    return true;
  }

  /** Select a privacy-safe user pin — approximate coords only. */
  selectUser(userId: string | null): boolean {
    if (!userId) {
      this.selection = {
        ...selectWorldEntity(this.selection, null),
        userSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedUserMarker();
      }
      this.syncUsersToRenderer();
      this.emit();
      return true;
    }
    const record = this.usersRegistry.get(userId);
    if (!record || record.mapVisible !== true) return false;
    if (
      typeof record.approximateLatitude !== "number" ||
      typeof record.approximateLongitude !== "number"
    ) {
      return false;
    }
    this.selection = {
      ...selectWorldEntity(this.selection, record.id),
      userSheetOpen: true,
      placeSheetOpen: false,
      educationSheetOpen: false,
      gameSheetOpen: false,
      commerceSheetOpen: false,
      eventSheetOpen: false,
    };
    this.syncUsersToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
      this.renderer.clearSelectedEducationMarker();
      this.renderer.clearSelectedGameMarker();
      this.renderer.clearSelectedCommerceMarker();
      this.renderer.clearSelectedEventMarker();
      this.renderer.setSelectedUserMarkerId(record.id);
      this.renderer.focusPlaceAt(
        record.approximateLatitude,
        record.approximateLongitude
      );
    }
    this.emit();
    return true;
  }

  selectGame(gameId: string | null): boolean {
    if (!gameId) {
      this.selection = {
        ...selectWorldEntity(this.selection, null),
        gameSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedGameMarker();
      }
      this.syncGamesToRenderer();
      this.emit();
      return true;
    }
    const record = this.gamesRegistry.get(gameId);
    if (!record) return false;
    if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
      return false;
    }
    this.selection = {
      ...selectWorldEntity(this.selection, record.id),
      gameSheetOpen: true,
      placeSheetOpen: false,
      educationSheetOpen: false,
      userSheetOpen: false,
      commerceSheetOpen: false,
      eventSheetOpen: false,
    };
    this.syncGamesToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
      this.renderer.clearSelectedEducationMarker();
      this.renderer.clearSelectedUserMarker();
      this.renderer.clearSelectedCommerceMarker();
      this.renderer.clearSelectedEventMarker();
      this.renderer.setSelectedGameMarkerId(record.id);
      this.renderer.focusPlaceAt(record.latitude, record.longitude);
    }
    this.emit();
    return true;
  }

  selectCommerce(commerceId: string | null): boolean {
    if (!commerceId) {
      this.selection = {
        ...selectWorldEntity(this.selection, null),
        commerceSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedCommerceMarker();
      }
      this.syncCommerceToRenderer();
      this.emit();
      return true;
    }
    const record = this.commerceRegistry.get(commerceId);
    if (!record) return false;
    if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
      return false;
    }
    this.selection = {
      ...selectWorldEntity(this.selection, record.id),
      commerceSheetOpen: true,
      placeSheetOpen: false,
      educationSheetOpen: false,
      userSheetOpen: false,
      gameSheetOpen: false,
      eventSheetOpen: false,
    };
    this.syncCommerceToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
      this.renderer.clearSelectedEducationMarker();
      this.renderer.clearSelectedUserMarker();
      this.renderer.clearSelectedGameMarker();
      this.renderer.clearSelectedEventMarker();
      this.renderer.setSelectedCommerceMarkerId(record.id);
      this.renderer.focusPlaceAt(record.latitude, record.longitude);
    }
    this.emit();
    return true;
  }

  selectEvent(eventId: string | null): boolean {
    if (!eventId) {
      this.selection = {
        ...selectWorldEntity(this.selection, null),
        eventSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedEventMarker();
      }
      this.syncEventsToRenderer();
      this.emit();
      return true;
    }
    const record = this.eventsRegistry.get(eventId);
    if (!record) return false;
    if (typeof record.latitude !== "number" || typeof record.longitude !== "number") {
      return false;
    }
    this.selection = {
      ...selectWorldEntity(this.selection, record.id),
      eventSheetOpen: true,
      placeSheetOpen: false,
      educationSheetOpen: false,
      userSheetOpen: false,
      gameSheetOpen: false,
      commerceSheetOpen: false,
    };
    this.syncEventsToRenderer();
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
      this.renderer.clearSelectedEducationMarker();
      this.renderer.clearSelectedUserMarker();
      this.renderer.clearSelectedGameMarker();
      this.renderer.clearSelectedCommerceMarker();
      this.renderer.setSelectedEventMarkerId(record.id);
      this.renderer.focusPlaceAt(record.latitude, record.longitude);
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
      this.syncPlacesToRenderer();
    } else if (categoryId === "education") {
      this.syncEducationToRenderer();
    } else if (categoryId === "users") {
      this.syncUsersToRenderer();
    } else if (categoryId === "games") {
      this.syncGamesToRenderer();
    } else if (categoryId === "businesses") {
      this.syncCommerceToRenderer();
    } else if (categoryId === "events") {
      this.syncEventsToRenderer();
    } else {
      this.syncPlacesToRenderer();
      this.syncEducationToRenderer();
      this.syncUsersToRenderer();
      this.syncGamesToRenderer();
      this.syncCommerceToRenderer();
      this.syncEventsToRenderer();
    }
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
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_EDUCATION_LAYER_ID, false);
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_USERS_LAYER_ID, false);
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_GAMES_LAYER_ID, false);
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_COMMERCE_LAYER_ID, false);
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_EVENTS_LAYER_ID, false);
    this.syncPlacesToRenderer();
    this.syncEducationToRenderer();
    this.syncUsersToRenderer();
    this.syncGamesToRenderer();
    this.syncCommerceToRenderer();
    this.syncEventsToRenderer();
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
      educationSheetOpen: false,
      userSheetOpen: false,
      gameSheetOpen: false,
      commerceSheetOpen: false,
      eventSheetOpen: false,
    };
    if (isMapLibreRendererAdapter(this.renderer)) {
      this.renderer.clearSelectedPlaceMarker();
      this.renderer.clearSelectedEducationMarker();
      this.renderer.clearSelectedUserMarker();
      this.renderer.clearSelectedGameMarker();
      this.renderer.clearSelectedCommerceMarker();
      this.renderer.clearSelectedEventMarker();
    }
    this.syncPlacesToRenderer();
    this.syncEducationToRenderer();
    this.syncUsersToRenderer();
    this.syncGamesToRenderer();
    this.syncCommerceToRenderer();
    this.syncEventsToRenderer();
    this.emit();
  }

  private bindPlacePressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setPlacePressHandler((placeId) => {
      this.selectPlace(placeId);
    });
  }

  private bindEducationPressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setEducationPressHandler((educationId) => {
      this.selectEducation(educationId);
    });
  }

  private bindUserPressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setUserPressHandler((userId) => {
      this.selectUser(userId);
    });
  }

  private bindGamePressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setGamePressHandler((gameId) => {
      this.selectGame(gameId);
    });
  }

  private bindCommercePressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setCommercePressHandler((commerceId) => {
      this.selectCommerce(commerceId);
    });
  }

  private bindEventPressHandler(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    this.renderer.setEventPressHandler((eventId) => {
      this.selectEvent(eventId);
    });
  }

  private syncPlacesToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const placesBound = this.dataPipeline.isKindAvailable("places");
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

  private syncEducationToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const educationBound = this.dataPipeline.isKindAvailable("education");
    if (!educationBound) {
      this.renderer.setEducationMarkers([]);
      this.renderer
        .getLayerAdapter()
        .setLayerVisibility(WORLD_EDUCATION_LAYER_ID, false);
      return;
    }
    const visible = this.selection.selectedCategories.includes(
      WORLD_EDUCATION_LAYER_ID
    );
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_EDUCATION_LAYER_ID, visible);
    this.renderer.setEducationMarkers(
      visible
        ? worldEducationToMarkers(this.educationRegistry.listMappable())
        : []
    );
  }

  private syncUsersToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const usersBound = this.dataPipeline.isKindAvailable("users");
    if (!usersBound) {
      this.renderer.setUserMarkers([]);
      this.renderer
        .getLayerAdapter()
        .setLayerVisibility(WORLD_USERS_LAYER_ID, false);
      return;
    }
    const visible = this.selection.selectedCategories.includes(
      WORLD_USERS_LAYER_ID
    );
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_USERS_LAYER_ID, visible);
    this.renderer.setUserMarkers(
      visible
        ? worldUsersToMarkers(this.usersRegistry.listMappable())
        : []
    );
  }

  private syncGamesToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const gamesBound = this.dataPipeline.isKindAvailable("games");
    if (!gamesBound) {
      this.renderer.setGameMarkers([]);
      this.renderer
        .getLayerAdapter()
        .setLayerVisibility(WORLD_GAMES_LAYER_ID, false);
      return;
    }
    const visible = this.selection.selectedCategories.includes(WORLD_GAMES_LAYER_ID);
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_GAMES_LAYER_ID, visible);
    this.renderer.setGameMarkers(
      visible ? worldGamesToMarkers(this.gamesRegistry.listMappable()) : []
    );
  }

  private syncCommerceToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const commerceBound = this.dataPipeline.isKindAvailable("commerce");
    if (!commerceBound) {
      this.renderer.setCommerceMarkers([]);
      this.renderer
        .getLayerAdapter()
        .setLayerVisibility(WORLD_COMMERCE_LAYER_ID, false);
      return;
    }
    const visible = this.selection.selectedCategories.includes(
      WORLD_COMMERCE_LAYER_ID
    );
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_COMMERCE_LAYER_ID, visible);
    this.renderer.setCommerceMarkers(
      visible
        ? worldCommerceToMarkers(this.commerceRegistry.listMappable())
        : []
    );
  }

  private syncEventsToRenderer(): void {
    if (!isMapLibreRendererAdapter(this.renderer)) return;
    const eventsBound = this.dataPipeline.isKindAvailable("events");
    if (!eventsBound) {
      this.renderer.setEventMarkers([]);
      this.renderer
        .getLayerAdapter()
        .setLayerVisibility(WORLD_EVENTS_LAYER_ID, false);
      return;
    }
    const visible = this.selection.selectedCategories.includes(
      WORLD_EVENTS_LAYER_ID
    );
    this.renderer
      .getLayerAdapter()
      .setLayerVisibility(WORLD_EVENTS_LAYER_ID, visible);
    this.renderer.setEventMarkers(
      visible
        ? worldEventsToMarkers(this.eventsRegistry.listMappable())
        : []
    );
  }

  private syncAllLayersToRenderer(): void {
    this.syncPlacesToRenderer();
    this.syncEducationToRenderer();
    this.syncUsersToRenderer();
    this.syncGamesToRenderer();
    this.syncCommerceToRenderer();
    this.syncEventsToRenderer();
  }

  private async loadPlaces(): Promise<void> {
    this.placeRegistry.clear();
    this.educationRegistry.clear();
    this.usersRegistry.clear();
    this.gamesRegistry.clear();
    this.commerceRegistry.clear();
    this.eventsRegistry.clear();
    try {
      const bundle = await this.dataPipeline.loadAll();
      this.lastDataBundle = bundle;

      if (this.dataPipeline.isKindAvailable("places")) {
        const accepted = this.placeRegistry.registerAll(
          Array.isArray(bundle.places) ? bundle.places : []
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
      }

      if (this.dataPipeline.isKindAvailable("education")) {
        const eduAccepted = this.educationRegistry.registerAll(
          Array.isArray(bundle.education) ? bundle.education : []
        );
        if (
          eduAccepted > 0 &&
          !this.selection.selectedCategories.includes(WORLD_EDUCATION_LAYER_ID)
        ) {
          this.selection = {
            ...this.selection,
            selectedCategories: [
              ...this.selection.selectedCategories,
              WORLD_EDUCATION_LAYER_ID,
            ],
          };
        }
      }

      if (this.dataPipeline.isKindAvailable("users")) {
        const usersAccepted = this.usersRegistry.registerAll(
          Array.isArray(bundle.users) ? bundle.users : []
        );
        if (
          usersAccepted > 0 &&
          !this.selection.selectedCategories.includes(WORLD_USERS_LAYER_ID)
        ) {
          this.selection = {
            ...this.selection,
            selectedCategories: [
              ...this.selection.selectedCategories,
              WORLD_USERS_LAYER_ID,
            ],
          };
        }
      }
      if (this.dataPipeline.isKindAvailable("games")) {
        const gamesAccepted = this.gamesRegistry.registerAll(
          Array.isArray(bundle.games) ? bundle.games : []
        );
        if (
          gamesAccepted > 0 &&
          !this.selection.selectedCategories.includes(WORLD_GAMES_LAYER_ID)
        ) {
          this.selection = {
            ...this.selection,
            selectedCategories: [
              ...this.selection.selectedCategories,
              WORLD_GAMES_LAYER_ID,
            ],
          };
        }
      }
      if (this.dataPipeline.isKindAvailable("commerce")) {
        const commerceAccepted = this.commerceRegistry.registerAll(
          Array.isArray(bundle.commerce) ? bundle.commerce : []
        );
        if (
          commerceAccepted > 0 &&
          !this.selection.selectedCategories.includes(WORLD_COMMERCE_LAYER_ID)
        ) {
          this.selection = {
            ...this.selection,
            selectedCategories: [
              ...this.selection.selectedCategories,
              WORLD_COMMERCE_LAYER_ID,
            ],
          };
        }
      }
      if (this.dataPipeline.isKindAvailable("events")) {
        const eventsAccepted = this.eventsRegistry.registerAll(
          Array.isArray(bundle.events) ? bundle.events : []
        );
        if (
          eventsAccepted > 0 &&
          !this.selection.selectedCategories.includes(WORLD_EVENTS_LAYER_ID)
        ) {
          this.selection = {
            ...this.selection,
            selectedCategories: [
              ...this.selection.selectedCategories,
              WORLD_EVENTS_LAYER_ID,
            ],
          };
        }
      }
    } catch {
      this.placeRegistry.clear();
      this.educationRegistry.clear();
      this.usersRegistry.clear();
      this.gamesRegistry.clear();
      this.commerceRegistry.clear();
      this.eventsRegistry.clear();
      this.lastDataBundle = null;
    }
    this.syncPlacesToRenderer();
    this.syncEducationToRenderer();
    this.syncUsersToRenderer();
    this.syncGamesToRenderer();
    this.syncCommerceToRenderer();
    this.syncEventsToRenderer();
  }

  private async runLoadCycle(): Promise<void> {
    const token = ++this.runToken;
    const dataBound = isWorldDataSourceBound(this.dataSource);
    const mapSourceBound = isWorldMapSourceAvailable(this.mapSource);
    const placeProviderBound = this.dataPipeline.isKindAvailable("places");
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
        educationSheetOpen: false,
        userSheetOpen: false,
        gameSheetOpen: false,
        commerceSheetOpen: false,
        eventSheetOpen: false,
      };
      if (isMapLibreRendererAdapter(this.renderer)) {
        this.renderer.clearSelectedPlaceMarker();
        this.renderer.clearSelectedEducationMarker();
        this.renderer.clearSelectedUserMarker();
        this.renderer.clearSelectedGameMarker();
        this.renderer.clearSelectedCommerceMarker();
        this.renderer.clearSelectedEventMarker();
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
    const placeProviderBound = this.dataPipeline.isKindAvailable("places");
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
