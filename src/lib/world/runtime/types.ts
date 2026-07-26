/**
 * World Runtime Foundation — sole authority for World operational state.
 * No map SDK / tiles / vendor engines.
 */

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
};
