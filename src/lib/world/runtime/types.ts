/**
 * World Runtime Foundation — sole authority for World operational state.
 * No map SDK / tiles / vendor engines.
 */

import type { MapSourceRegistry } from "@/src/lib/world/mapSource";
import type { WorldRendererAdapter } from "@/src/lib/world/renderer";
import type { WorldFoundationSnapshot } from "@/src/lib/world/types";

export type WorldRuntimePhase =
  | "preparing"
  | "loading"
  | "ready"
  | "unavailable"
  | "error";

export type WorldRuntimeState = {
  phase: WorldRuntimePhase;
  message: string;
  errorMessage: string | null;
  snapshot: WorldFoundationSnapshot | null;
  attempt: number;
  dataSourceBound: boolean;
  rendererBound: boolean;
  /** True when Runtime resolved an available WorldMapSource. */
  mapSourceBound: boolean;
};

/**
 * Provider-agnostic World data contract.
 * Implementations must not import MapLibre, Google Maps, Mapbox, Cesium, or PMTiles.
 */
export type WorldDataSource = {
  readonly id: string;
  /** True only when a trusted World data provider is bound and reachable. */
  isAvailable(): boolean;
  loadSnapshot(): Promise<WorldFoundationSnapshot>;
};

export type WorldRuntimeControllerOptions = {
  dataSource?: WorldDataSource | null;
  /** Yield before load so Retry paints preparing/loading. */
  yieldMs?: number;
  /**
   * Renderer adapter — Runtime is the only owner.
   * When omitted, Runtime builds MapLibre from the resolved Map Source (or null).
   * Pass `null` / explicit adapter to override (tests).
   */
  renderer?: WorldRendererAdapter | null;
  /** Map source registry — Runtime selects exclusively from this. */
  mapSourceRegistry?: MapSourceRegistry | null;
  /** Preferred map source id; falls back to first available. */
  mapSourceId?: string | null;
};
