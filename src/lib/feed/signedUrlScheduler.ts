export const WATCH_SIGNED_URL_HIGH_COUNT = 3;
export const WATCH_SIGNED_URL_WINDOW = 10;
export const WATCH_SIGNED_URL_HIGH_CONCURRENCY = 3;
export const WATCH_SIGNED_URL_LOW_CONCURRENCY = 2;

export type SignedUrlPriority = 0 | 1 | 2;

export type SignedUrlJob<T> = {
  id: string;
  path: string;
  priority: SignedUrlPriority;
};

export type PlanWatchSignedUrlWorkInput = {
  videos: Array<{ id: string; videoPath?: string | null; src?: string | null }>;
  activeIndex: number;
};

export type PlannedSignedUrlWork = {
  active: SignedUrlJob<string> | null;
  nextHigh: SignedUrlJob<string>[];
  nextLow: SignedUrlJob<string>[];
  all: SignedUrlJob<string>[];
};

export function signedUrlPriorityForOffset(
  offsetFromActive: number
): SignedUrlPriority | null {
  if (offsetFromActive === 0) return 0;
  if (offsetFromActive >= 1 && offsetFromActive <= WATCH_SIGNED_URL_HIGH_COUNT) {
    return 1;
  }
  if (
    offsetFromActive > WATCH_SIGNED_URL_HIGH_COUNT &&
    offsetFromActive <= WATCH_SIGNED_URL_WINDOW
  ) {
    return 2;
  }
  return null;
}

export function planWatchSignedUrlWork(
  input: PlanWatchSignedUrlWorkInput
): PlannedSignedUrlWork {
  const videos = input.videos;
  const activeIndex = Number.isFinite(input.activeIndex)
    ? Math.trunc(input.activeIndex)
    : 0;
  const active: SignedUrlJob<string> | null = null;
  const nextHigh: SignedUrlJob<string>[] = [];
  const nextLow: SignedUrlJob<string>[] = [];
  const seen = new Set<string>();
  let resolvedActive: SignedUrlJob<string> | null = active;

  for (let offset = 0; offset <= WATCH_SIGNED_URL_WINDOW; offset += 1) {
    const index = activeIndex + offset;
    const video = videos[index];
    if (!video) continue;
    const path = video.videoPath?.trim() ?? "";
    if (!path) continue;
    const dedupeKey = path;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const priority = signedUrlPriorityForOffset(offset);
    if (priority == null) continue;
    const job: SignedUrlJob<string> = {
      id: video.id,
      path,
      priority,
    };
    if (priority === 0) resolvedActive = job;
    else if (priority === 1) nextHigh.push(job);
    else nextLow.push(job);
  }

  return {
    active: resolvedActive,
    nextHigh,
    nextLow,
    all: [
      ...(resolvedActive ? [resolvedActive] : []),
      ...nextHigh,
      ...nextLow,
    ],
  };
}

export function maxConcurrencyForPriority(
  priority: SignedUrlPriority
): number {
  if (priority === 0) return 1;
  if (priority === 1) return WATCH_SIGNED_URL_HIGH_CONCURRENCY;
  return WATCH_SIGNED_URL_LOW_CONCURRENCY;
}

export type RunPrioritizedJobsInput<T> = {
  jobs: Array<{ id: string; priority: SignedUrlPriority; run: () => Promise<T> }>;
  isCurrent?: () => boolean;
  onResult?: (id: string, value: T) => void;
};

/**
 * Priority 0 starts immediately and never waits on later jobs.
 * Priority 1 uses up to 3 workers. Priority 2 uses up to 2.
 * Later jobs never block earlier priorities from starting.
 */
export async function runPrioritizedSignedUrlJobs<T>(
  input: RunPrioritizedJobsInput<T>
): Promise<void> {
  const isCurrent = input.isCurrent ?? (() => true);
  const byPriority = new Map<SignedUrlPriority, typeof input.jobs>();
  for (const job of input.jobs) {
    const list = byPriority.get(job.priority) ?? [];
    list.push(job);
    byPriority.set(job.priority, list);
  }

  const runPool = async (
    jobs: typeof input.jobs,
    limit: number
  ): Promise<void> => {
    if (jobs.length === 0) return;
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(limit, jobs.length) },
      async () => {
        while (cursor < jobs.length) {
          if (!isCurrent()) return;
          const index = cursor;
          cursor += 1;
          const job = jobs[index];
          if (!job) return;
          const value = await job.run();
          if (!isCurrent()) return;
          input.onResult?.(job.id, value);
        }
      }
    );
    await Promise.all(workers);
  };

  const active = byPriority.get(0) ?? [];
  const high = byPriority.get(1) ?? [];
  const low = byPriority.get(2) ?? [];

  const activeRun = runPool(active, 1);
  const restRun = (async () => {
    await runPool(high, WATCH_SIGNED_URL_HIGH_CONCURRENCY);
    if (!isCurrent()) return;
    await runPool(low, WATCH_SIGNED_URL_LOW_CONCURRENCY);
  })();

  await Promise.all([activeRun, restRun]);
}

export function createInflightDeduper<T>() {
  const inflight = new Map<string, Promise<T>>();
  return {
    run(key: string, factory: () => Promise<T>): Promise<T> {
      const existing = inflight.get(key);
      if (existing) return existing;
      const pending = factory().finally(() => {
        inflight.delete(key);
      });
      inflight.set(key, pending);
      return pending;
    },
    has(key: string): boolean {
      return inflight.has(key);
    },
    size(): number {
      return inflight.size;
    },
    clear(): void {
      inflight.clear();
    },
  };
}
