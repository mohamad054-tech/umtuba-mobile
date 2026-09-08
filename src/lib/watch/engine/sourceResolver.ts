import {
  isLegacyHttpPlaybackUrl,
  isLocalWatchPlaybackUri,
} from "@/src/lib/feed/videoStoragePath";

import type {
  WatchEngineLocalProbe,
  WatchEngineSourceResolution,
} from "./types";

function rejectLocal(probe: WatchEngineLocalProbe): WatchEngineSourceResolution["rejected"] {
  if (!probe.exists) return "missing-local";
  if (!(probe.bytes > 0)) return "zero-byte";
  if (!probe.complete) return "partial";
  if (!isLocalWatchPlaybackUri(probe.uri)) return "missing-local";
  return null;
}

export function isUsableWatchEngineLocalFile(
  probe: WatchEngineLocalProbe | null | undefined
): probe is WatchEngineLocalProbe {
  if (!probe) return false;
  return rejectLocal(probe) == null;
}

/**
 * Single authoritative source for any Watch item.
 * Local retention is optional. Eviction must never yield a dead player.
 */
export function resolveWatchEngineSource(input: {
  mediaId: string | null | undefined;
  retained?: WatchEngineLocalProbe | null;
  forwardCache?: WatchEngineLocalProbe | null;
  remoteUrl?: string | null;
  remoteExpired?: boolean;
}): WatchEngineSourceResolution {
  const mediaId = (input.mediaId ?? "").trim();
  if (!mediaId) {
    return {
      mediaId: "",
      uri: "",
      kind: "unresolved",
      needsRefresh: false,
      rejected: "identity-missing",
    };
  }

  if (isUsableWatchEngineLocalFile(input.retained)) {
    return {
      mediaId,
      uri: input.retained.uri,
      kind: "local-retained",
      needsRefresh: false,
      rejected: null,
    };
  }

  if (isUsableWatchEngineLocalFile(input.forwardCache)) {
    return {
      mediaId,
      uri: input.forwardCache.uri,
      kind: "local-forward",
      needsRefresh: false,
      rejected: null,
    };
  }

  const remote = (input.remoteUrl ?? "").trim();
  if (isLegacyHttpPlaybackUrl(remote) && input.remoteExpired !== true) {
    return {
      mediaId,
      uri: remote,
      kind: "remote",
      needsRefresh: false,
      rejected: null,
    };
  }

  if (isLegacyHttpPlaybackUrl(remote) && input.remoteExpired === true) {
    return {
      mediaId,
      uri: "",
      kind: "unresolved",
      needsRefresh: true,
      rejected: "stale-remote",
    };
  }

  const retainedReject = input.retained ? rejectLocal(input.retained) : null;
  return {
    mediaId,
    uri: "",
    kind: "unresolved",
    needsRefresh: true,
    rejected: retainedReject ?? "empty-remote",
  };
}

export function watchEngineSourceIsPlayable(
  resolution: WatchEngineSourceResolution
): boolean {
  return resolution.kind !== "unresolved" && resolution.uri.length > 0;
}

/** Never keep a deleted or unusable local URI as the player source. */
export function shouldReplaceWatchEngineSource(input: {
  currentUri: string | null | undefined;
  next: WatchEngineSourceResolution;
}): boolean {
  const current = (input.currentUri ?? "").trim();
  if (!watchEngineSourceIsPlayable(input.next)) return false;
  if (!current) return true;
  if (isLocalWatchPlaybackUri(current) && input.next.kind === "remote") {
    return true;
  }
  return current !== input.next.uri;
}
