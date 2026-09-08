import { resolveWatchEngineAudioOwner } from "./audio";
import { planWatchEngineDiskWindow } from "./cache";
import { resolveWatchEngineReleaseTarget } from "./gesture";
import { clampWatchEngineIndex, watchEngineIndexFromOffset } from "./identity";
import { planWatchEnginePlayerSlots } from "./players";
import {
  resolveWatchEngineSource,
  watchEngineSourceIsPlayable,
} from "./sourceResolver";
import type {
  WatchEngineEffects,
  WatchEngineLocalProbe,
  WatchEnginePlaybackSource,
  WatchEngineSourceResolution,
  WatchEngineState,
} from "./types";

export function createInitialWatchEngineState(
  mediaIds: string[] = []
): WatchEngineState {
  const first = mediaIds[0] ?? null;
  return {
    visibleIndex: 0,
    settledIndex: 0,
    targetIndex: 0,
    direction: "none",
    currentMediaId: first,
    playbackSource: null,
    audioOwner: first,
    surfaceReady: false,
    firstFrameReady: false,
    forwardCache: [],
    backwardCache: [],
    gesturePhase: "idle",
    feedLength: mediaIds.length,
    mediaIds,
    snapGeneration: 0,
  };
}

function mediaIdAt(state: WatchEngineState, index: number): string | null {
  return state.mediaIds[index] ?? null;
}

function withAudio(state: WatchEngineState): WatchEngineState {
  const incoming = mediaIdAt(state, state.targetIndex);
  const settled = mediaIdAt(state, state.settledIndex);
  const slots = planWatchEnginePlayerSlots({
    settledIndex: state.settledIndex,
    itemCount: state.feedLength,
    direction: state.direction,
  });
  const mounted = [slots.current, slots.next, slots.previous]
    .filter((index): index is number => index != null)
    .map((index) => mediaIdAt(state, index))
    .filter((id): id is string => Boolean(id));
  const audio = resolveWatchEngineAudioOwner({
    settledMediaId: settled,
    incomingMediaId: incoming,
    incomingFirstFrame: state.firstFrameReady && incoming === state.currentMediaId,
    gesturePhase: state.gesturePhase,
    mountedMediaIds: mounted,
  });
  return { ...state, audioOwner: audio.owner };
}

export function createWatchPlaybackController(mediaIds: string[] = []) {
  let state = createInitialWatchEngineState(mediaIds);

  const setState = (next: WatchEngineState): WatchEngineState => {
    state = withAudio(next);
    return state;
  };

  return {
    getState(): WatchEngineState {
      return state;
    },

    setMediaIds(nextIds: string[]): WatchEngineState {
      const settled =
        clampWatchEngineIndex(state.settledIndex, nextIds.length) ?? 0;
      return setState({
        ...state,
        mediaIds: nextIds,
        feedLength: nextIds.length,
        settledIndex: settled,
        visibleIndex: settled,
        targetIndex: settled,
        currentMediaId: nextIds[settled] ?? null,
        direction: "none",
        gesturePhase: "idle",
      });
    },

    beginGesture(fromIndex: number): WatchEngineState {
      const from = clampWatchEngineIndex(fromIndex, state.feedLength) ?? state.settledIndex;
      return setState({
        ...state,
        gesturePhase: "dragging",
        visibleIndex: from,
        settledIndex: from,
        targetIndex: from,
        direction: "none",
        firstFrameReady: false,
        surfaceReady: false,
      });
    },

    moveGesture(visibleIndex: number): WatchEngineState {
      const visible =
        clampWatchEngineIndex(visibleIndex, state.feedLength) ?? state.visibleIndex;
      const direction =
        visible > state.settledIndex
          ? "forward"
          : visible < state.settledIndex
            ? "backward"
            : state.direction;
      return setState({
        ...state,
        visibleIndex: visible,
        direction,
      });
    },

    releaseGesture(input: {
      fromIndex: number;
      currentOffset: number;
      dragStartOffset: number;
      itemHeight: number;
      velocityY?: number | null;
    }): { state: WatchEngineState; effects: WatchEngineEffects } {
      const decision = resolveWatchEngineReleaseTarget({
        ...input,
        itemCount: state.feedLength,
      });
      const target = decision?.targetIndex ?? state.settledIndex;
      const generation = state.snapGeneration + 1;
      const next = setState({
        ...state,
        gesturePhase: "settling",
        targetIndex: target,
        direction: decision?.direction ?? "none",
        currentMediaId: mediaIdAt(state, target),
        snapGeneration: generation,
        firstFrameReady: false,
        surfaceReady: false,
      });
      return {
        state: next,
        effects: {
          snap: { index: target, generation },
        },
      };
    },

    /**
     * Native settled page is the only index writer after the gesture.
     * Never emits a second snap.
     */
    nativeSettled(input: {
      offset: number;
      itemHeight: number;
    }): { state: WatchEngineState; effects: WatchEngineEffects } {
      const index =
        watchEngineIndexFromOffset(
          input.offset,
          input.itemHeight,
          state.feedLength
        ) ?? state.targetIndex;
      const mediaId = mediaIdAt(state, index);
      const next = setState({
        ...state,
        gesturePhase: "idle",
        settledIndex: index,
        visibleIndex: index,
        targetIndex: index,
        direction: "none",
        currentMediaId: mediaId,
        firstFrameReady: state.currentMediaId === mediaId && state.firstFrameReady,
        surfaceReady: state.currentMediaId === mediaId && state.surfaceReady,
      });
      return { state: next, effects: { snap: null } };
    },

    markSurfaceReady(mediaId: string): WatchEngineState {
      if (mediaId !== state.currentMediaId) return state;
      return setState({ ...state, surfaceReady: true });
    },

    markFirstFrame(mediaId: string): WatchEngineState {
      if (mediaId !== state.currentMediaId) return state;
      return setState({ ...state, firstFrameReady: true, surfaceReady: true });
    },

    applyResolvedSource(
      resolution: WatchEngineSourceResolution
    ): WatchEngineState {
      if (resolution.mediaId !== state.currentMediaId) return state;
      if (
        !watchEngineSourceIsPlayable(resolution) ||
        resolution.kind === "unresolved"
      ) {
        return setState({ ...state, playbackSource: null });
      }
      const playbackSource: WatchEnginePlaybackSource = {
        mediaId: resolution.mediaId,
        uri: resolution.uri,
        kind: resolution.kind,
      };
      return setState({ ...state, playbackSource });
    },

    resolveCurrentSource(input: {
      retained?: WatchEngineLocalProbe | null;
      forwardCache?: WatchEngineLocalProbe | null;
      remoteUrl?: string | null;
      remoteExpired?: boolean;
    }): WatchEngineSourceResolution {
      return resolveWatchEngineSource({
        mediaId: state.currentMediaId,
        ...input,
      });
    },

    syncCachePlan(): WatchEngineState {
      const plan = planWatchEngineDiskWindow({
        mediaIds: state.mediaIds,
        settledIndex: state.settledIndex,
        previouslyKept: [...state.forwardCache, ...state.backwardCache],
      });
      return setState({
        ...state,
        forwardCache: plan.forward,
        backwardCache: plan.previous,
      });
    },
  };
}

export type WatchPlaybackController = ReturnType<
  typeof createWatchPlaybackController
>;
