import { describe, expect, it } from "vitest";

import {
  TAB_BAR_MIN_HEIGHT,
  TAB_ICON_SIZE,
  TAB_ICON_SIZE_BEFORE,
  TAB_ICON_SIZE_CREATE,
  TAB_ITEM_MIN_HEIGHT,
  TAB_LABEL_FONT_SIZE,
  tabIconSize,
} from "./tabBarMetrics";

describe("primary tab icon metrics", () => {
  it("raises Watch/Discover to 24 and Create to 28 with 48dp items", () => {
    expect(TAB_ICON_SIZE_BEFORE).toBe(11);
    expect(TAB_ICON_SIZE).toBe(24);
    expect(TAB_ICON_SIZE_CREATE).toBe(28);
    expect(TAB_ICON_SIZE_CREATE).toBeGreaterThan(TAB_ICON_SIZE);
    expect(TAB_ITEM_MIN_HEIGHT).toBeGreaterThanOrEqual(48);
    expect(TAB_BAR_MIN_HEIGHT).toBeGreaterThanOrEqual(TAB_ITEM_MIN_HEIGHT);
    expect(TAB_LABEL_FONT_SIZE).toBeGreaterThanOrEqual(10);
    expect(tabIconSize("watch")).toBe(24);
    expect(tabIconSize("discover")).toBe(24);
    expect(tabIconSize("create")).toBe(28);
  });

});
