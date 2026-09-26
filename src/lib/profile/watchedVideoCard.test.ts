import { describe, expect, it } from "vitest";

import {
  shouldShowWatchedVideoCard,
  watchedVideoFirstLine,
  watchedVideoReadingOffer,
} from "./watchedVideoCard";

describe("watched video card", () => {
  it("shows only when a profile was opened from a video", () => {
    expect(shouldShowWatchedVideoCard(12)).toBe(true);
    expect(shouldShowWatchedVideoCard(null)).toBe(false);
    expect(shouldShowWatchedVideoCard(0)).toBe(false);
  });

  it("uses the first line, and offers reading only for an article or a long text", () => {
    expect(watchedVideoFirstLine("سطر أول\nسطر ثان")).toBe("سطر أول");
    expect(
      watchedVideoReadingOffer({ caption: "قصير", article: null })
    ).toBeNull();
    expect(
      watchedVideoReadingOffer({
        caption: "قصير",
        article: { title: "المقال", body: "نص المقال" },
      })
    ).toEqual({ title: "المقال", body: "نص المقال" });
    const long = "أ".repeat(180);
    expect(
      watchedVideoReadingOffer({ caption: long, article: null })?.body
    ).toBe(long);
  });
});
