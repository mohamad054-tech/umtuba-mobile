import { describe, expect, it } from "vitest";

import {
  overlayTextAlign,
  overlayTextDirection,
  overlayTextStyle,
} from "./overlayText";

describe("OVERLAY_TEXT", () => {
  it("ARABIC_TEXT: Arabic content stays RTL and right-aligned", () => {
    expect(overlayTextDirection("مرحبا")).toBe("rtl");
    expect(overlayTextAlign("مرحبا بالعالم")).toBe("right");
    expect(overlayTextStyle("مرحبا").writingDirection).toBe("rtl");
    expect(overlayTextStyle("مرحبا").textAlign).toBe("right");
  });

  it("TEXT_RENDER: English overlay text stays LTR and is not forced RTL", () => {
    expect(overlayTextDirection("Hello")).toBe("ltr");
    expect(overlayTextAlign("Hello")).toBe("center");
    expect(overlayTextStyle("Hello").writingDirection).toBe("ltr");
  });

  it("mixed Arabic-first text keeps Arabic writing direction", () => {
    expect(overlayTextDirection("مرحبا Hello")).toBe("rtl");
    expect(overlayTextDirection("Hello مرحبا")).toBe("ltr");
  });
});
