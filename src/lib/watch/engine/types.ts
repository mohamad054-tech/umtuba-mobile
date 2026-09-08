export type WatchEngineDirection = "forward" | "backward" | "none";

export type WatchEngineGesturePhase = "idle" | "dragging" | "settling";

export type WatchEngineSourceKind =
  | "local-retained"
  | "local-forward"
  | "remote"
  | "unresolved";

export type WatchEnginePlaybackSource = {
  mediaId: string;
  uri: string;
  kind: Exclude<WatchEngineSourceKind, "unresolved">;
};

export type WatchEngineLocalProbe = {
  uri: string;
  exists: boolean;
  bytes: number;
  complete: boolean;
};

export type WatchEngineSourceResolution = {
  mediaId: string;
  uri: string;
  kind: WatchEngineSourceKind;
  needsRefresh: boolean;
  rejected:
    | null
    | "missing-local"
    | "zero-byte"
    | "partial"
    | "stale-remote"
    | "empty-remote"
    | "identity-missing";
};

export type WatchEnginePlayerSlots = {
  current: number;
  next: number | null;
  previous: number | null;
};

export type WatchEngineCachePlan = {
  current: string | null;
  forward: string[];
  previous: string[];
  keep: string[];
  evict: string[];
  olderHistory: string[];
};

export type WatchEngineSnapCommand = {
  index: number;
  generation: number;
};

export type WatchEngineEffects = {
  snap: WatchEngineSnapCommand | null;
};

export type WatchEngineState = {
  visibleIndex: number;
  settledIndex: number;
  targetIndex: number;
  direction: WatchEngineDirection;
  currentMediaId: string | null;
  playbackSource: WatchEnginePlaybackSource | null;
  audioOwner: string | null;
  surfaceReady: boolean;
  firstFrameReady: boolean;
  forwardCache: string[];
  backwardCache: string[];
  gesturePhase: WatchEngineGesturePhase;
  feedLength: number;
  mediaIds: string[];
  snapGeneration: number;
};

export type WatchEngineStartupMarks = {
  processStartMs: number | null;
  watchMountMs: number | null;
  sourceResolvedMs: number | null;
  surfaceAttachedMs: number | null;
  firstFrameMs: number | null;
  firstAudioMs: number | null;
  usableMs: number | null;
};
