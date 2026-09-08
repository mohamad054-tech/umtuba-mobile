import { clampWatchEngineIndex } from "./identity";
import type { WatchEngineCachePlan } from "./types";

export const WATCH_ENGINE_CURRENT = 1;
export const WATCH_ENGINE_FORWARD_READY = 5;
export const WATCH_ENGINE_PREVIOUS_RETAINED = 5;

export function planWatchEngineDiskWindow(input: {
  mediaIds: readonly string[];
  settledIndex: number;
  previouslyKept?: readonly string[];
}): WatchEngineCachePlan {
  const settled = clampWatchEngineIndex(input.settledIndex, input.mediaIds.length);
  const current = settled == null ? null : input.mediaIds[settled] ?? null;
  const forward: string[] = [];
  const previous: string[] = [];

  if (settled != null) {
    for (
      let i = settled + 1;
      i < input.mediaIds.length && forward.length < WATCH_ENGINE_FORWARD_READY;
      i += 1
    ) {
      const id = input.mediaIds[i];
      if (id) forward.push(id);
    }
    for (
      let i = settled - 1;
      i >= 0 && previous.length < WATCH_ENGINE_PREVIOUS_RETAINED;
      i -= 1
    ) {
      const id = input.mediaIds[i];
      if (id) previous.push(id);
    }
  }

  const keepSet = new Set<string>();
  if (current) keepSet.add(current);
  for (const id of forward) keepSet.add(id);
  for (const id of previous) keepSet.add(id);
  const keep = [...keepSet];

  const olderHistory: string[] = [];
  for (let i = 0; i < input.mediaIds.length; i += 1) {
    const id = input.mediaIds[i];
    if (!id || keepSet.has(id)) continue;
    olderHistory.push(id);
  }

  const previouslyKept = input.previouslyKept ?? [];
  const evict = previouslyKept.filter((id) => id && !keepSet.has(id));

  return {
    current,
    forward,
    previous,
    keep,
    evict,
    olderHistory,
  };
}

export function watchEngineForwardNeedsReplenish(plan: WatchEngineCachePlan): boolean {
  return plan.forward.length < WATCH_ENGINE_FORWARD_READY;
}

export function watchEnginePreviousRetainedCount(plan: WatchEngineCachePlan): number {
  return plan.previous.length;
}
