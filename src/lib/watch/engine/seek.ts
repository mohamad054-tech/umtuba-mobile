import { resolveSeekTimeOrNull } from "@/src/lib/watch/playbackPolicy";

import {
  resolveWatchEngineWantsPlay,
  shouldRecreateWatchEnginePlayer,
  shouldStartWatchEnginePlayback,
} from "./readiness";

export type WatchEngineSeekCommand = {
  token: number;
  ratio: number;
};

export function resolveWatchEngineSeekSeconds(input: {
  ratio: number;
  duration: number;
}): number | null {
  return resolveSeekTimeOrNull(input.ratio, input.duration);
}

export function shouldRecreateWatchEnginePlayerOnSeek(): false {
  return false;
}

export function resolveWatchEnginePlayAfterSeek(input: {
  isCurrent: boolean;
  screenFocused: boolean;
  userPaused: boolean;
  sourcePlayable: boolean;
  surfaceAttached: boolean;
}): boolean {
  const wantsPlay = resolveWatchEngineWantsPlay({
    isCurrent: input.isCurrent,
    screenFocused: input.screenFocused,
    userPaused: input.userPaused,
  });
  return shouldStartWatchEnginePlayback({
    wantsPlay,
    sourcePlayable: input.sourcePlayable,
    surfaceAttached: input.surfaceAttached,
  });
}

export function watchEngineSeekKeepsIdentity(input: {
  mediaId: string;
  src: string;
}): boolean {
  return (
    shouldRecreateWatchEnginePlayer({
      previousMediaId: input.mediaId,
      nextMediaId: input.mediaId,
      previousSrc: input.src,
      nextSrc: input.src,
    }) === false && shouldRecreateWatchEnginePlayerOnSeek() === false
  );
}
