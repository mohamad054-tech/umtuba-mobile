/**
 * Android-only Watch transition marks. No URLs or tokens.
 */

export type WatchTransitionPhase =
  | "current_end"
  | "next_source_activation"
  | "next_ready"
  | "first_frame"
  | "surface_attached"
  | "audio_start";

export type WatchTransitionMark = {
  t: number;
  phase: WatchTransitionPhase;
  index?: number;
  waitedMs?: number;
  readiness?: string;
};

export type WatchBindMark = {
  t: number;
  visibleIndex: number;
  visibleMediaId: string;
  activeIndex: number;
  activeMediaId: string;
  playerMediaId: string;
  surfaceAttached: boolean;
  aligned: boolean;
};

export type WatchCacheMark = {
  t: number;
  target: number;
  cachedIds: string[];
  hits: string[];
  misses: string[];
  evicted: string[];
};

export function markWatchTransition(
  platform: string | null | undefined,
  phase: WatchTransitionPhase,
  extra?: Omit<WatchTransitionMark, "t" | "phase">
): WatchTransitionMark | null {
  if (platform !== "android") return null;
  const mark: WatchTransitionMark = {
    t: Date.now(),
    phase,
    ...extra,
  };
  console.log(`WATCH_TX ${JSON.stringify(mark)}`);
  return mark;
}

export function markWatchCellBind(
  platform: string | null | undefined,
  extra: Omit<WatchBindMark, "t">
): WatchBindMark | null {
  if (platform !== "android") return null;
  const mark: WatchBindMark = {
    t: Date.now(),
    ...extra,
  };
  console.log(`WATCH_BIND ${JSON.stringify(mark)}`);
  return mark;
}

export function markWatchCache(
  platform: string | null | undefined,
  extra: Omit<WatchCacheMark, "t">
): WatchCacheMark | null {
  if (platform !== "android") return null;
  const mark: WatchCacheMark = {
    t: Date.now(),
    ...extra,
  };
  console.log(`WATCH_CACHE ${JSON.stringify(mark)}`);
  return mark;
}
