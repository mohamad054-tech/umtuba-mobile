import { describe, expect, it } from "vitest";

import { SHEET_BOTTOM_COMFORT_PX, sheetBottomPadding } from "./sheetSafeBottom";

describe("sheetBottomPadding", () => {
  it("keeps the last row above 3-button and gesture bars", () => {
    expect(sheetBottomPadding(48)).toBe(48 + SHEET_BOTTOM_COMFORT_PX);
    expect(sheetBottomPadding(24)).toBe(24 + SHEET_BOTTOM_COMFORT_PX);
    expect(sheetBottomPadding(0, 48)).toBe(48 + SHEET_BOTTOM_COMFORT_PX);
    expect(sheetBottomPadding(0, 0)).toBe(SHEET_BOTTOM_COMFORT_PX);
  });
});
