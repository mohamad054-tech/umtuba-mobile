import { describe, expect, it } from "vitest";

import { shouldRequestWatchEngineFeedTail } from "./feedTail";

describe("shouldRequestWatchEngineFeedTail", () => {
  it("replenishes when the settled item is near the end", () => {
    expect(
      shouldRequestWatchEngineFeedTail({
        settledIndex: 16,
        itemCount: 20,
        hasMore: true,
      })
    ).toBe(true);
  });

  it("does not request while another page is loading", () => {
    expect(
      shouldRequestWatchEngineFeedTail({
        settledIndex: 18,
        itemCount: 20,
        hasMore: true,
        loadingMore: true,
      })
    ).toBe(false);
  });
});
