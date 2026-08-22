import type { SupabaseClient } from "@supabase/supabase-js";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  createSignedUrlCache,
  watchSignedUrlCache,
  type SignedUrlCache,
} from "@/src/lib/feed/signedUrlCache";
import {
  createInflightDeduper,
  planWatchSignedUrlWork,
  runPrioritizedSignedUrlJobs,
  type SignedUrlPriority,
} from "@/src/lib/feed/signedUrlScheduler";
import { normalizeVideoStoragePath } from "@/src/lib/feed/videoStoragePath";
import { createVideoSignedUrl } from "@/src/lib/feed/watchFeed";

export type WatchPlaybackPrepOptions = {
  cache?: SignedUrlCache;
  sign?: (path: string) => Promise<string | null>;
  isCurrent?: () => boolean;
  onResolved?: (videoId: string, src: string) => void;
};

export type WatchPlaybackPrepResult = {
  activeSrc: string | null;
  resolvedIds: string[];
  ignoredStale: boolean;
};

const defaultDeduper = createInflightDeduper<string | null>();

export function resolvePlaybackSource(row: {
  video_path?: string | null;
  video_url?: string | null;
}): {
  path: string | null;
  legacyUrl: string | null;
  skipReason: "empty" | "unsafe" | null;
} {
  const pathResult = normalizeVideoStoragePath(row.video_path);
  if (pathResult.ok) {
    return { path: pathResult.path, legacyUrl: null, skipReason: null };
  }
  const legacy = (row.video_url ?? "").trim();
  if (legacy.startsWith("http://") || legacy.startsWith("https://")) {
    return { path: null, legacyUrl: legacy, skipReason: null };
  }
  if (pathResult.reason === "unsafe") {
    return { path: null, legacyUrl: null, skipReason: "unsafe" };
  }
  return { path: null, legacyUrl: null, skipReason: "empty" };
}

export async function resolveOneSignedUrl(
  supabase: SupabaseClient,
  path: string,
  options?: {
    cache?: SignedUrlCache;
    sign?: (path: string) => Promise<string | null>;
    forceRefresh?: boolean;
  }
): Promise<string | null> {
  const normalized = normalizeVideoStoragePath(path);
  if (!normalized.ok) return null;
  const cache = options?.cache ?? watchSignedUrlCache;
  if (!options?.forceRefresh) {
    const cached = cache.peek(normalized.path);
    if (cached) return cached;
  } else {
    cache.invalidate(normalized.path);
  }
  const sign =
    options?.sign ??
    ((nextPath: string) => createVideoSignedUrl(supabase, nextPath));
  return defaultDeduper.run(normalized.path, async () => {
    const stillCached = options?.forceRefresh
      ? null
      : cache.peek(normalized.path);
    if (stillCached) return stillCached;
    const signed = await sign(normalized.path);
    if (signed) cache.set(normalized.path, signed);
    return signed;
  });
}

export async function prepareWatchPlaybackUrls(
  supabase: SupabaseClient,
  videos: WatchVideo[],
  activeIndex: number,
  options: WatchPlaybackPrepOptions = {}
): Promise<WatchPlaybackPrepResult> {
  const isCurrent = options.isCurrent ?? (() => true);
  const cache = options.cache ?? watchSignedUrlCache;
  const plan = planWatchSignedUrlWork({ videos, activeIndex });
  const resolvedIds: string[] = [];
  let ignoredStale = false;

  const runJob = async (
    videoId: string,
    path: string
  ): Promise<string | null> => {
    if (!isCurrent()) {
      ignoredStale = true;
      return null;
    }
    const src = await resolveOneSignedUrl(supabase, path, {
      cache,
      sign: options.sign,
    });
    if (!isCurrent()) {
      ignoredStale = true;
      return null;
    }
    if (src) {
      resolvedIds.push(videoId);
      options.onResolved?.(videoId, src);
    }
    return src;
  };

  let activeSrc: string | null = null;
  if (plan.active) {
    activeSrc = await runJob(plan.active.id, plan.active.path);
  }

  if (!isCurrent()) {
    return { activeSrc, resolvedIds, ignoredStale: true };
  }

  const rest = [...plan.nextHigh, ...plan.nextLow].map((job) => ({
    id: job.id,
    priority: job.priority as SignedUrlPriority,
    run: () => runJob(job.id, job.path),
  }));

  void runPrioritizedSignedUrlJobs({
    jobs: rest,
    isCurrent,
    onResult: () => undefined,
  });

  return { activeSrc, resolvedIds, ignoredStale };
}

export function createIsolatedPlaybackPrepDeps(): {
  cache: SignedUrlCache;
} {
  return { cache: createSignedUrlCache() };
}
