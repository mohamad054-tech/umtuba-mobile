import { describe, expect, it } from "vitest";

import {
  createInflightDeduper,
  planWatchSignedUrlWork,
  runPrioritizedSignedUrlJobs,
  signedUrlPriorityForOffset,
  WATCH_SIGNED_URL_HIGH_CONCURRENCY,
  WATCH_SIGNED_URL_LOW_CONCURRENCY,
  WATCH_SIGNED_URL_WINDOW,
} from "./signedUrlScheduler";

function videos(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `post-${i + 1}`,
    videoPath: `owner/${i + 1}.mp4`,
    src: "",
  }));
}

describe("planWatchSignedUrlWork", () => {
  it("does not put the entire 12-row page on the active critical path", () => {
    const plan = planWatchSignedUrlWork({
      videos: videos(12),
      activeIndex: 0,
    });
    expect(plan.active?.id).toBe("post-1");
    expect(plan.nextHigh.map((job) => job.id)).toEqual([
      "post-2",
      "post-3",
      "post-4",
    ]);
    expect(plan.nextLow).toHaveLength(7);
    expect(plan.all).toHaveLength(11);
    expect(plan.all.length).toBeLessThan(12);
  });

  it("replenishes a rolling next-10 window on advance", () => {
    const first = planWatchSignedUrlWork({
      videos: videos(16),
      activeIndex: 0,
    });
    const second = planWatchSignedUrlWork({
      videos: videos(16),
      activeIndex: 1,
    });
    expect(first.active?.path).toBe("owner/1.mp4");
    expect(second.active?.path).toBe("owner/2.mp4");
    expect(second.nextHigh[0]?.path).toBe("owner/3.mp4");
    expect(second.all[second.all.length - 1]?.path).toBe("owner/12.mp4");
    expect(signedUrlPriorityForOffset(0)).toBe(0);
    expect(signedUrlPriorityForOffset(3)).toBe(1);
    expect(signedUrlPriorityForOffset(4)).toBe(2);
    expect(signedUrlPriorityForOffset(WATCH_SIGNED_URL_WINDOW + 1)).toBeNull();
  });
});

describe("runPrioritizedSignedUrlJobs", () => {
  it("does not make active wait for the rest of the feed", async () => {
    const started: string[] = [];
    let releaseActive!: () => void;
    const activeGate = new Promise<void>((resolve) => {
      releaseActive = resolve;
    });
    let highStartedWhileActiveHeld = false;

    const activeDone = runPrioritizedSignedUrlJobs({
      jobs: [
        {
          id: "active",
          priority: 0,
          run: async () => {
            started.push("active");
            await activeGate;
            return "active-url";
          },
        },
        {
          id: "next-1",
          priority: 1,
          run: async () => {
            started.push("next-1");
            if (!started.includes("active-finished")) {
              highStartedWhileActiveHeld = started.includes("active");
            }
            return "n1";
          },
        },
      ],
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toContain("active");
    expect(started).toContain("next-1");
    expect(highStartedWhileActiveHeld).toBe(true);
    releaseActive();
    await activeDone;
  });

  it("does not sign the whole page sequentially", async () => {
    let maxInflight = 0;
    let inflight = 0;
    const order: string[] = [];
    const jobs = Array.from({ length: 10 }, (_, i) => ({
      id: `j${i}`,
      priority: (i === 0 ? 0 : i <= 3 ? 1 : 2) as 0 | 1 | 2,
      run: async () => {
        inflight += 1;
        maxInflight = Math.max(maxInflight, inflight);
        order.push(`j${i}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inflight -= 1;
        return i;
      },
    }));
    await runPrioritizedSignedUrlJobs({ jobs });
    expect(maxInflight).toBeGreaterThan(1);
    expect(maxInflight).toBeLessThanOrEqual(
      1 + WATCH_SIGNED_URL_HIGH_CONCURRENCY
    );
    expect(order[0]).toBe("j0");
  });

  it("bounds high and low concurrency", async () => {
    let maxHigh = 0;
    let highInflight = 0;
    let maxLow = 0;
    let lowInflight = 0;
    const jobs = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `h${i}`,
        priority: 1 as const,
        run: async () => {
          highInflight += 1;
          maxHigh = Math.max(maxHigh, highInflight);
          await new Promise((resolve) => setTimeout(resolve, 8));
          highInflight -= 1;
          return i;
        },
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `l${i}`,
        priority: 2 as const,
        run: async () => {
          lowInflight += 1;
          maxLow = Math.max(maxLow, lowInflight);
          await new Promise((resolve) => setTimeout(resolve, 8));
          lowInflight -= 1;
          return i;
        },
      })),
    ];
    await runPrioritizedSignedUrlJobs({ jobs });
    expect(maxHigh).toBeLessThanOrEqual(WATCH_SIGNED_URL_HIGH_CONCURRENCY);
    expect(maxLow).toBeLessThanOrEqual(WATCH_SIGNED_URL_LOW_CONCURRENCY);
  });

  it("ignores stale results after a generation change", async () => {
    let current = 1;
    const applied: string[] = [];
    const pending = runPrioritizedSignedUrlJobs({
      jobs: [
        {
          id: "old",
          priority: 1,
          run: async () => {
            current = 2;
            await new Promise((resolve) => setTimeout(resolve, 5));
            return "stale";
          },
        },
      ],
      isCurrent: () => current === 1,
      onResult: (id) => applied.push(id),
    });
    await pending;
    expect(applied).toEqual([]);
  });
});

describe("inflight dedupe", () => {
  it("shares one in-flight sign for the same path", async () => {
    const dedupe = createInflightDeduper<string>();
    let calls = 0;
    const factory = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "https://signed/x";
    };
    const [a, b] = await Promise.all([
      dedupe.run("owner/a.mp4", factory),
      dedupe.run("owner/a.mp4", factory),
    ]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });
});
