import {
  buildWorldExperienceViewState,
  createDefaultWorldUiSelection,
  toggleWorldCategorySelection,
  WORLD_RETRY_YIELD_MS,
  type WorldExperienceViewState,
  type WorldUiSelectionState,
} from "@/src/lib/world/experience";
import type { WorldCategoryId } from "@/src/lib/world/types";
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

function initialRuntimeState(): WorldRuntimeState {
  return {
    phase: "preparing",
    message: worldRuntimePhaseMessage("preparing"),
    errorMessage: null,
    snapshot: null,
    attempt: 0,
    dataSourceBound: false,
  };
}

/**
 * Sole runtime authority for UM World operational state.
 * Screen UI must consume this controller — not invent parallel load logic.
 */
export class WorldRuntimeController {
  private dataSource: WorldDataSource;
  private yieldMs: number;
  private state: WorldRuntimeState = initialRuntimeState();
  private selection: WorldUiSelectionState = createDefaultWorldUiSelection();
  private listeners = new Set<Listener>();
  private runToken = 0;
  private started = false;

  constructor(options?: WorldRuntimeControllerOptions) {
    this.dataSource = options?.dataSource ?? createUnboundWorldDataSource();
    this.yieldMs =
      typeof options?.yieldMs === "number" && options.yieldMs >= 0
        ? options.yieldMs
        : WORLD_RETRY_YIELD_MS;
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

  getSelection(): WorldUiSelectionState {
    return { ...this.selection, selectedCategories: [...this.selection.selectedCategories] };
  }

  getViewState(): WorldExperienceViewState {
    const runtime = this.state;
    const loading =
      runtime.phase === "preparing" || runtime.phase === "loading";
    const base = buildWorldExperienceViewState({
      snapshot: runtime.snapshot ?? undefined,
      selection: this.selection,
      loading,
      errorMessage:
        runtime.phase === "error" ? runtime.errorMessage : null,
    });

    if (runtime.phase === "preparing") {
      return {
        ...base,
        phase: "preparing",
        message: worldRuntimePhaseMessage("preparing"),
      };
    }
    if (runtime.phase === "loading") {
      return {
        ...base,
        phase: "loading",
        message: worldRuntimePhaseMessage("loading"),
      };
    }
    if (runtime.phase === "ready") {
      return {
        ...base,
        phase: "ready",
        message: worldRuntimePhaseMessage("ready", runtime.snapshot?.message),
      };
    }
    if (runtime.phase === "error") {
      return {
        ...base,
        phase: "error",
        errorMessage: runtime.errorMessage,
        message: worldRuntimePhaseMessage("error"),
      };
    }
    return {
      ...base,
      phase: "unavailable",
      message: worldRuntimePhaseMessage(
        "unavailable",
        runtime.snapshot?.message ?? base.message
      ),
    };
  }

  /** Begin runtime — preparing → loading → terminal phase. */
  async start(): Promise<void> {
    if (!this.started) {
      this.started = true;
      this.setPhase("preparing");
    }
    await this.runLoadCycle();
  }

  /** Retry must go through the controller only. */
  async retry(): Promise<void> {
    this.setPhase(
      this.state.phase === "preparing" ? "preparing" : "loading"
    );
    await this.runLoadCycle();
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
    const bound = isWorldDataSourceBound(this.dataSource);

    this.state = {
      ...this.state,
      phase: "loading",
      message: worldRuntimePhaseMessage("loading"),
      errorMessage: null,
      attempt: this.state.attempt + 1,
      dataSourceBound: bound,
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

      const phase = resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: bound,
        snapshot,
        errorMessage: null,
      });

      this.state = {
        phase,
        message: worldRuntimePhaseMessage(phase, snapshot.message),
        errorMessage: phase === "error" ? snapshot.message : null,
        snapshot,
        attempt: this.state.attempt,
        dataSourceBound: bound,
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
        dataSourceBound: bound,
      };
      this.emit();
    }
  }

  private setPhase(phase: WorldRuntimePhase): void {
    if (!canTransitionWorldRuntimePhase(this.state.phase, phase)) {
      // Fail soft: still move to loading for retry paths.
      if (phase === "loading" || phase === "preparing") {
        this.state = {
          ...this.state,
          phase,
          message: worldRuntimePhaseMessage(phase),
          errorMessage: null,
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
