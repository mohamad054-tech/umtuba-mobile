/**
 * In-process World Runtime metrics — never sent externally.
 */

export type WorldRuntimeMetricKey =
  | "world_open_ms"
  | "map_source_switch_ms"
  | "layer_update_ms";

export type WorldRuntimeMetricsSnapshot = {
  worldOpenMs: number | null;
  mapSourceSwitchMs: number | null;
  layerUpdateMs: number | null;
  samples: Partial<Record<WorldRuntimeMetricKey, number>>;
};

export type WorldRuntimeMetrics = {
  markStart(key: WorldRuntimeMetricKey): void;
  markEnd(key: WorldRuntimeMetricKey): number | null;
  record(key: WorldRuntimeMetricKey, durationMs: number): void;
  getSnapshot(): WorldRuntimeMetricsSnapshot;
  reset(): void;
};

function nowMs(): number {
  return Date.now();
}

export function createWorldRuntimeMetrics(): WorldRuntimeMetrics {
  const pending = new Map<WorldRuntimeMetricKey, number>();
  const samples: Partial<Record<WorldRuntimeMetricKey, number>> = {};

  const record = (key: WorldRuntimeMetricKey, durationMs: number): void => {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    samples[key] = durationMs;
  };

  return {
    markStart(key) {
      pending.set(key, nowMs());
    },
    markEnd(key) {
      const start = pending.get(key);
      if (start == null) return null;
      pending.delete(key);
      const duration = nowMs() - start;
      record(key, duration);
      return duration;
    },
    record,
    getSnapshot(): WorldRuntimeMetricsSnapshot {
      return {
        worldOpenMs: samples.world_open_ms ?? null,
        mapSourceSwitchMs: samples.map_source_switch_ms ?? null,
        layerUpdateMs: samples.layer_update_ms ?? null,
        samples: { ...samples },
      };
    },
    reset() {
      pending.clear();
      for (const key of Object.keys(samples)) {
        delete samples[key as WorldRuntimeMetricKey];
      }
    },
  };
}
