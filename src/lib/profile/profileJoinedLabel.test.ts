import { describe, expect, it } from "vitest";

import {
  formatAboutJoinedBody,
  formatJoinedMonthYear,
  stripJoinedPrefix,
} from "@/src/lib/profile/profileJoinedLabel";

describe("profileJoinedLabel", () => {
  it("strips a duplicated Joined prefix", () => {
    expect(stripJoinedPrefix("Joined March 2024")).toBe("March 2024");
    expect(stripJoinedPrefix("march 2024")).toBe("march 2024");
    expect(stripJoinedPrefix("")).toBe("");
    expect(stripJoinedPrefix(null)).toBe("");
  });

  it("returns a date-only About body", () => {
    expect(formatAboutJoinedBody("Joined March 2024")).toBe("March 2024");
    expect(formatAboutJoinedBody("   ")).toBeNull();
  });

  it("formats created_at as locale month year and rejects junk", () => {
    expect(formatJoinedMonthYear("2024-03-12T00:00:00.000Z", "en")).toBe(
      "March 2024"
    );
    expect(formatJoinedMonthYear("not-a-date", "en")).toBeNull();
    expect(formatJoinedMonthYear(null, "ar")).toBeNull();
  });
});
