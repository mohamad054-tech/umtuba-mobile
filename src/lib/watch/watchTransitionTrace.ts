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

export type WatchDragMark = {
  t: number;
  phase: "WATCH_DRAG";
  fingerDown: boolean;
  beginDrag: boolean;
  contentOffsetY: number;
  pageHeight: number;
  fromIndex: number;
  targetIndex: number | null;
  displacementPx: number;
  displacementPercent: number;
  activeIndex: number;
  pendingTarget: number | null;
  targetReady: boolean;
  surfaceReady: boolean;
  firstFrameReady: boolean;
  audioOwner: number | null;
  commitAttempt: boolean;
  commitAccepted: boolean;
  rejectReason: string;
};

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

export function markWatchDrag(
  platform: string | null | undefined,
  extra: Omit<WatchDragMark, "t" | "phase">
): WatchDragMark | null {
  if (platform !== "android") return null;
  const mark: WatchDragMark = {
    t: Date.now(),
    phase: "WATCH_DRAG",
    ...extra,
  };
  console.log(`WATCH_DRAG ${JSON.stringify(mark)}`);
  return mark;
}

export function markWatchAudioStartOnce(
  platform: string | null | undefined,
  input: {
    index: number;
    mediaId: string;
    generation: number;
    lastKey: string | null;
  }
): { marked: boolean; key: string } {
  const key = `${input.index}:${input.mediaId}:${input.generation}`;
  if (input.lastKey === key) {
    return { marked: false, key };
  }
  markWatchTransition(platform, "audio_start", { index: input.index });
  return { marked: true, key };
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
