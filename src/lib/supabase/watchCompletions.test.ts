import { describe, expect, it, vi } from "vitest";

import {
  loadRecentWatchCompletions,
  recordWatchCompletion,
} from "./watchCompletions";

describe("watch completions", () => {
  it("records through record_post_watch_completion only", async () => {
    const rpc = vi.fn(async () => ({ data: { ok: true, postId: 9 }, error: null }));
    const from = vi.fn();
    const result = await recordWatchCompletion(
      { rpc, from } as never,
      9
    );
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("record_post_watch_completion", {
      p_post_id: 9,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("loads the viewer's recent completions and ignores guests", async () => {
    expect(await loadRecentWatchCompletions({ from: vi.fn() } as never, null)).toEqual(
      []
    );

    const now = Date.now();
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [{ post_id: 3, watched_at: new Date(now - 1000).toISOString() }],
              error: null,
            })),
          })),
        })),
      })),
    }));
    const entries = await loadRecentWatchCompletions(
      { from } as never,
      "11111111-1111-4111-8111-111111111111"
    );
    expect(from).toHaveBeenCalledWith("post_watch_completions");
    expect(entries).toEqual([{ postId: 3, watchedAt: expect.any(Number) }]);
  });
});
