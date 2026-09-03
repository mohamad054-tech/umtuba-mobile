import type { WatchVideo } from "@/src/contracts/watch";
import {
  isLegacyHttpPlaybackUrl,
  isLocalWatchPlaybackUri,
} from "@/src/lib/feed/videoStoragePath";

import type { WatchMediaCachePort } from "./androidWatchMediaCache";
import { watchMediaIdentity } from "./watchCellBinding";

export type RetainedIdentityRef = {
  postId: number;
  videoId: string;
  mediaId: string;
  localUri: string;
  remoteUri?: string | null;
};

export type LocalWatchFileCheck = {
  usable: boolean;
  reason: "ok" | "not-local" | "missing" | "zero-byte" | "unreadable";
};

export type RetainedPlaybackResolution = {
  src: string;
  usedLocal: boolean;
  invalidated: boolean;
  reason:
    | "local"
    | "no-retained"
    | "identity-mismatch"
    | "missing-file"
    | "zero-byte"
    | "unreadable"
    | "remote-fallback";
};

export type PrefetchActiveIsolation = {
  src: string;
  error: string | null;
  displayError: boolean;
};

/** A post must never receive another post's retained local URI. */
export function retainedWatchEntryMatchesFeedItem(
  entry: Pick<RetainedIdentityRef, "postId" | "videoId" | "mediaId">,
  video: Pick<WatchVideo, "id" | "postId">
): boolean {
  if (video.postId == null || !Number.isInteger(video.postId) || video.postId <= 0) {
    return false;
  }
  if (entry.postId !== video.postId) return false;
  if (entry.mediaId !== watchMediaIdentity(video)) return false;
  return true;
}

export async function inspectLocalWatchPlaybackFile(
  port: WatchMediaCachePort,
  uri: string | null | undefined
): Promise<LocalWatchFileCheck> {
  const trimmed = (uri ?? "").trim();
  if (!isLocalWatchPlaybackUri(trimmed)) {
    return { usable: false, reason: "not-local" };
  }
  try {
    const exists = await port.exists(trimmed);
    if (!exists) return { usable: false, reason: "missing" };
    const size = await port.size(trimmed);
    if (!(size > 0)) return { usable: false, reason: "zero-byte" };
    return { usable: true, reason: "ok" };
  } catch {
    return { usable: false, reason: "unreadable" };
  }
}

export function remoteWatchPlaybackFallbackSrc(
  video: Pick<WatchVideo, "src">,
  retained?: Pick<RetainedIdentityRef, "remoteUri"> | null
): string {
  const current = (video.src ?? "").trim();
  if (isLegacyHttpPlaybackUrl(current)) return current;
  const remote = (retained?.remoteUri ?? "").trim();
  if (isLegacyHttpPlaybackUrl(remote)) return remote;
  if (isLocalWatchPlaybackUri(current)) return "";
  return current;
}

/**
 * Before any retained file:// replaces the signed remote source: file must
 * exist and size > 0. Missing/zero/unreadable → keep HTTPS, never file://.
 */
export async function resolveRetainedWatchPlaybackSrc(input: {
  video: WatchVideo;
  retained?: RetainedIdentityRef | null;
  port: WatchMediaCachePort;
}): Promise<RetainedPlaybackResolution> {
  const remote = remoteWatchPlaybackFallbackSrc(input.video, input.retained);
  if (!input.retained) {
    return {
      src: remote || input.video.src,
      usedLocal: false,
      invalidated: false,
      reason: "no-retained",
    };
  }
  if (!retainedWatchEntryMatchesFeedItem(input.retained, input.video)) {
    return {
      src: remote || input.video.src,
      usedLocal: false,
      invalidated: false,
      reason: "identity-mismatch",
    };
  }
  const check = await inspectLocalWatchPlaybackFile(
    input.port,
    input.retained.localUri
  );
  if (check.usable) {
    return {
      src: input.retained.localUri,
      usedLocal: true,
      invalidated: false,
      reason: "local",
    };
  }
  const reason =
    check.reason === "missing"
      ? "missing-file"
      : check.reason === "zero-byte" || check.reason === "unreadable"
        ? check.reason
        : "remote-fallback";
  return {
    src: remote,
    usedLocal: false,
    invalidated: true,
    reason,
  };
}

export function shouldApplyLocalWatchUriToVideo(input: {
  video: Pick<WatchVideo, "id" | "postId">;
  candidateMediaId: string;
  candidatePostId?: number | null;
  candidateUri: string;
  fileUsable: boolean;
}): boolean {
  if (!input.fileUsable) return false;
  if (!isLocalWatchPlaybackUri(input.candidateUri)) return false;
  if (input.candidateMediaId !== watchMediaIdentity(input.video)) return false;
  if (
    input.candidatePostId != null &&
    input.video.postId != null &&
    input.candidatePostId !== input.video.postId
  ) {
    return false;
  }
  return true;
}

/**
 * Background prefetch failure must not replace or display an error on the
 * currently active cell.
 */
export function isolatePrefetchFailureFromActiveCell(input: {
  failedMediaId: string;
  activeMediaId: string;
  activeSrc: string;
  activeError: string | null;
}): PrefetchActiveIsolation {
  return {
    src: input.activeSrc,
    error: input.activeError,
    displayError: false,
  };
}

export function shouldSurfacePrefetchFailureOnActiveCell(input: {
  failedMediaId: string;
  activeMediaId: string;
}): boolean {
  return isolatePrefetchFailureFromActiveCell({
    failedMediaId: input.failedMediaId,
    activeMediaId: input.activeMediaId,
    activeSrc: "",
    activeError: null,
  }).displayError;
}

/** Evict only when a sixth distinct durable video has been stored. */
export function shouldEvictWatchDurableOldest(input: {
  retainedCountBefore: number;
  incomingIsNew: boolean;
  incomingStored: boolean;
  target?: number;
}): boolean {
  if (!input.incomingStored || !input.incomingIsNew) return false;
  return input.retainedCountBefore >= (input.target ?? 5);
}

export function ordinaryAdvanceKeepsNeighbor(input: {
  fromIndex: number;
  toIndex: number;
  evictedMediaIds: string[];
  neighborMediaId: string;
}): boolean {
  const step = input.toIndex - input.fromIndex;
  if (step !== 1) return false;
  if (
    (input.fromIndex === 0 && input.toIndex === 1) ||
    (input.fromIndex === 1 && input.toIndex === 2)
  ) {
    return !input.evictedMediaIds.includes(input.neighborMediaId);
  }
  return !input.evictedMediaIds.includes(input.neighborMediaId);
}
