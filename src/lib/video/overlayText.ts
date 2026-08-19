/**
 * Overlay text writing direction is derived from content, not from UI locale.
 * The interaction canvas stays physical/LTR; Arabic shaping stays RTL.
 */

export type OverlayTextDirection = "rtl" | "ltr";

const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z\u00C0-\u024F]/;

export function overlayTextDirection(
  text: string | undefined
): OverlayTextDirection {
  if (!text) return "ltr";
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return "rtl";
    if (LTR_CHAR.test(ch)) return "ltr";
  }
  return "ltr";
}

export function overlayTextAlign(
  text: string | undefined
): "left" | "right" | "center" {
  return overlayTextDirection(text) === "rtl" ? "right" : "center";
}

export function overlayTextStyle(text: string | undefined): {
  writingDirection: OverlayTextDirection;
  textAlign: "left" | "right" | "center";
} {
  return {
    writingDirection: overlayTextDirection(text),
    textAlign: overlayTextAlign(text),
  };
}
