import type { WatchEngineTimeline } from "./WatchEnginePlayer";

export type WatchEngineTimelineStore = {
  get(mediaId: string): WatchEngineTimeline | null;
  set(mediaId: string, next: WatchEngineTimeline): boolean;
  subscribe(mediaId: string, listener: () => void): () => void;
};

export function createWatchEngineTimelineStore(): WatchEngineTimelineStore {
  const byId: Record<string, WatchEngineTimeline> = {};
  const listeners = new Map<string, Set<() => void>>();

  return {
    get(mediaId) {
      return byId[mediaId] ?? null;
    },
    set(mediaId, next) {
      const current = byId[mediaId];
      if (
        current &&
        current.duration === next.duration &&
        Math.abs(current.currentTime - next.currentTime) < 0.2
      ) {
        return false;
      }
      byId[mediaId] = next;
      listeners.get(mediaId)?.forEach((listener) => listener());
      return true;
    },
    subscribe(mediaId, listener) {
      let set = listeners.get(mediaId);
      if (!set) {
        set = new Set();
        listeners.set(mediaId, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    },
  };
}

export function shouldRebuildWatchEngineRenderItemOnTimelineTick(): false {
  return false;
}
