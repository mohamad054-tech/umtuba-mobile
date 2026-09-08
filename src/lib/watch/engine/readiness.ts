import { isLocalWatchPlaybackUri } from "@/src/lib/feed/videoStoragePath";

import {
  resolveWatchEngineSource,
  watchEngineSourceIsPlayable,
} from "./sourceResolver";
import type { WatchEngineSourceResolution } from "./types";

export type WatchEngineReadiness =
  | "blocked"
  | "ready-buffered"
  | "ready-to-render";

export function resolveWatchEngineReadiness(input: {
  sourcePlayable: boolean;
  surfaceAttached: boolean;
  firstFrameReady: boolean;
}): WatchEngineReadiness {
  if (!input.sourcePlayable || !input.surfaceAttached) {
    return "blocked";
  }
  if (!input.firstFrameReady) {
    return "ready-buffered";
  }
  return "ready-to-render";
}

export function shouldStartWatchEnginePlayback(input: {
  wantsPlay: boolean;
  sourcePlayable: boolean;
  surfaceAttached: boolean;
}): boolean {
  return (
    input.wantsPlay === true &&
    input.sourcePlayable === true &&
    input.surfaceAttached === true
  );
}

export function shouldRecreateWatchEnginePlayer(input: {
  previousMediaId: string | null | undefined;
  nextMediaId: string;
  previousSrc: string | null | undefined;
  nextSrc: string;
}): boolean {
  const previousMediaId = (input.previousMediaId ?? "").trim();
  const nextMediaId = input.nextMediaId.trim();
  const previousSrc = (input.previousSrc ?? "").trim();
  const nextSrc = input.nextSrc.trim();
  if (!previousMediaId || !previousSrc || !nextMediaId || !nextSrc) {
    return true;
  }
  return previousMediaId !== nextMediaId || previousSrc !== nextSrc;
}

export function resolveWatchEngineItemSource(input: {
  mediaId: string;
  src?: string | null;
}): WatchEngineSourceResolution {
  const src = (input.src ?? "").trim();
  const local = isLocalWatchPlaybackUri(src);
  return resolveWatchEngineSource({
    mediaId: input.mediaId,
    retained: local
      ? { uri: src, exists: true, bytes: 1, complete: true }
      : null,
    remoteUrl: local ? null : src || null,
  });
}

export function watchEngineItemSourceUri(
  input: {
    mediaId: string;
    src?: string | null;
  }
): string | null {
  const resolution = resolveWatchEngineItemSource(input);
  return watchEngineSourceIsPlayable(resolution) ? resolution.uri : null;
}
