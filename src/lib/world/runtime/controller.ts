import {
  buildWorldExperienceViewState,
  createDefaultWorldUiSelection,
  toggleWorldCategorySelection,
  WORLD_RETRY_YIELD_MS,
  type WorldCameraControlId,
  type WorldExperienceViewState,
  type WorldUiSelectionState,
} from "@/src/lib/world/experience";
import type { WorldCategoryId } from "@/src/lib/world/types";
import {
  createDefaultMapSourceRegistry,
  isWorldMapSourceAvailable,
  type MapSourceRegistry,
  type WorldMapSource,
} from "@/src/lib/world/mapSource";
import {
  createMapLibreRendererAdapter,
  createNullRendererAdapter,
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
  mapSourceBound: boolean
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

/**
 * Sole runtime authority for UM World operational state + renderer slot.
 * Screen UI must consume this controller — not invent parallel load/render logic.
 * Map style selection is exclusively via MapSourceRegistry → WorldMapSource.
 */
export class WorldRuntimeController {
  private dataSource: WorldDataSource;
  private renderer: WorldRendererAdapter;
  private mapSourceRegistry: MapSourceRegistry;
  private mapSource: WorldMapSource | null;
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
      mapSourceBound
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

  getSelection(): WorldUiSelectionState {
    return {
      ...this.selection,
      selectedCategories: [...this.selection.selectedCategories],
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
    const base = buildWorldExperienceViewState({
      snapshot: runtime.snapshot ?? undefined,
      selection: this.selection,
      loading,
      errorMessage: runtime.phase === "error" ? runtime.errorMessage : null,
      rendererAdapter: this.renderer,
      attribution,
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
    }
    await this.runLoadCycle();
  }

  /** Retry must go through the controller only. */
  async retry(): Promise<void> {
    this.setPhase(
      this.state.phase === "preparing" ? "preparing" : "loading"
    );
    // Remount clears MapLibre style failures without UI talking to the SDK.
    try {
      this.renderer.mount();
    } catch {
      // Fail-closed.
    }
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

  toggleLayer(categoryId: WorldCategoryId, enabled: boolean): void {
    this.selection = {
      ...this.selection,
      selectedCategories: toggleWorldCategorySelection(
        this.selection.selectedCategories,
        categoryId,
        enabled
      ),
    };
    // Layer visibility requests go through Runtime-owned renderer adapter only.
    if (enabled) {
      this.renderer.getLayerAdapter().setLayerVisibility(categoryId, true);
    } else {
      this.renderer.getLayerAdapter().setLayerVisibility(categoryId, false);
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
    };
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
    };
    this.emit();
  }

  private async runLoadCycle(): Promise<void> {
    const token = ++this.runToken;
    const dataBound = isWorldDataSourceBound(this.dataSource);
    const mapSourceBound = isWorldMapSourceAvailable(this.mapSource);
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
    };
    this.emit();

    if (this.yieldMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.yieldMs);
      });
    }
    if (token !== this.runToken) return;

    try {
      const snapshot = await this.dataSource.loadSnapshot();
      if (token !== this.runToken) return;

      let phase = resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: dataBound,
        snapshot,
        errorMessage: null,
      });

      // Fail-closed: missing map source forces unavailable (no crash).
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
      };
      this.selection = {
        ...this.selection,
        selectedEntityId: null,
        detailsOpen: false,
      };
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
      };
      this.emit();
    }
  }

  private setPhase(phase: WorldRuntimePhase): void {
    const mapSourceBound = isWorldMapSourceAvailable(this.mapSource);
    if (!canTransitionWorldRuntimePhase(this.state.phase, phase)) {
      if (phase === "loading" || phase === "preparing") {
        this.state = {
          ...this.state,
          phase,
          message: worldRuntimePhaseMessage(phase),
          errorMessage: null,
          rendererBound: isRendererAdapterBound(this.renderer),
          mapSourceBound,
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
