import { describe, expect, it } from "vitest";

import { umStreakBadgeLabel, umStreakStateLabel, umStreakText } from "./copy";
import {
  detectUmStreakLocale,
  umStreakDirection,
  umStreakFlexDirection,
} from "./locale";

describe("UM Streak bilingual copy", () => {
  it("serves Arabic product copy and RTL direction", () => {
    expect(detectUmStreakLocale({ localeTag: "ar-SA" })).toBe("ar");
    expect(umStreakDirection("ar")).toBe("rtl");
    expect(umStreakFlexDirection("ar")).toBe("row-reverse");
    expect(umStreakText("viewOnce", "ar")).toBe("عرض مرة واحدة");
    expect(umStreakText("notPublic", "ar")).toContain("UM Life");
    expect(umStreakStateLabel("you_need_to_reply", "ar")).toBe("دورك اليوم");
    expect(umStreakBadgeLabel(30, "ar")).toBe("30 يوماً");
  });

  it("serves English copy without inventing money or points", () => {
    expect(detectUmStreakLocale({ localeTag: "en-US" })).toBe("en");
    expect(umStreakDirection("en")).toBe("ltr");
    expect(umStreakText("badge365", "en")).toBe("365 days");
    expect(umStreakText("send", "en")).not.toMatch(/point|coin|money|wallet/i);
    expect(umStreakText("notPublic", "en")).toMatch(/Not a UM Life post/);
  });
});
