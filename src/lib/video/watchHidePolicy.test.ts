import { describe, expect, it } from "vitest";

import {
  composeFeedWithWatchHide,
  createConsecutiveWatchTracker,
  QUALIFIED_WATCH_MS,
  sanitizeWatchHideEntries,
} from "./watchHidePolicy";

describe("watch hide policy", () => {
  it("drops expired and invalid local entries", () => {
    const now = Date.parse("2026-09-20T12:00:00.000Z");
    const entries = sanitizeWatchHideEntries(
      [
        { postId: 1, watchedAt: now - 2 * 24 * 60 * 60 * 1000 },
        { postId: 2, watchedAt: now - 15 * 24 * 60 * 60 * 1000 },
        { postId: "x", watchedAt: now },
        { postId: 1, watchedAt: now - 60_000 },
      ],
      now
    );
    expect(entries).toEqual([{ postId: 1, watchedAt: now - 60_000 }]);
  });

  it("hides recent watches and backfills oldest when fresh drop below 10", () => {
    const now = 1_000_000;
    const items = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));
    const hidden = Array.from({ length: 8 }, (_, index) => ({
      postId: index + 1,
      watchedAt: now - (8 - index) * 60_000,
    }));
    const composed = composeFeedWithWatchHide(items, (item) => item.id, hidden, {
      minUnwatched: 10,
      now,
    });
    expect(composed.map((item) => item.id)).toEqual([
      9, 10, 11, 12, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it("keeps a focused post even if it was watched", () => {
    const now = 1_000_000;
    const items = [{ id: 7 }, { id: 8 }, { id: 9 }];
    const composed = composeFeedWithWatchHide(
      items,
      (item) => item.id,
      [{ postId: 7, watchedAt: now - 1000 }],
      { keepPostId: 7, minUnwatched: 10, now }
    );
    expect(composed[0]?.id).toBe(7);
  });

  it("counts only consecutive playback and ignores seeks", () => {
    const fired: number[] = [];
    const tracker = createConsecutiveWatchTracker({
      onQualified: () => fired.push(1),
    });
    let now = 0;
    tracker.ingest(0, true, now);
    now += 1000;
    tracker.ingest(1000, true, now);
    now += 1000;
    tracker.ingest(2000, true, now);
    now += 1000;
    tracker.ingest(9000, true, now);
    expect(fired).toEqual([]);
    now += 1000;
    tracker.ingest(10000, true, now);
    now += 2000;
    tracker.ingest(12000, true, now);
    now += 2000;
    tracker.ingest(14000, true, now);
    now += 2000;
    tracker.ingest(16000, true, now);
    expect(fired).toEqual([1]);
    expect(QUALIFIED_WATCH_MS).toBe(5000);
  });

  it("does not qualify from appearance or idle ticks", () => {
    const fired: number[] = [];
    const tracker = createConsecutiveWatchTracker({
      onQualified: () => fired.push(1),
    });
    tracker.ingest(0, true, 0);
    tracker.ingest(40, true, 1000);
    tracker.ingest(40, false, 6000);
    expect(fired).toEqual([]);
  });
});
