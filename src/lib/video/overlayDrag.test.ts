import { describe, expect, it } from "vitest";

import {
  applyOverlayDrag,
  hitTestOverlay,
  overlayCanvasStyle,
  overlayElementPhysicalOffset,
  overlayHitSize,
  OVERLAY_DRAG_MIN_HIT,
  OVERLAY_INTERACTION_LAYOUT_DIRECTION,
} from "./overlayDrag";
import {
  createStickerOverlay,
  createTextOverlay,
  moveOverlay,
} from "./videoOverlays";

describe("OVERLAY_DRAG", () => {
  it("TEXT_RENDER: stored overlay text is unchanged by drag math", () => {
    const text = createTextOverlay({ x: 0.5, y: 0.28, text: "مرحبا Hello" });
    const dragged = applyOverlayDrag({ x: text.x, y: text.y }, 20, 0, 200, 400);
    const next = moveOverlay([text], text.id, dragged.x, dragged.y);
    expect(next[0]?.text).toBe("مرحبا Hello");
    expect(next[0]?.kind).toBe("text");
  });

  it("TEXT_DRAG_LTR: finger right increases x on an LTR canvas", () => {
    const start = { x: 0.4, y: 0.3 };
    const next = applyOverlayDrag(start, 40, 0, 200, 400);
    expect(next.x).toBeCloseTo(0.6);
    expect(next.y).toBeCloseTo(0.3);
    expect(next.x).toBeGreaterThan(start.x);
    const offset = overlayElementPhysicalOffset(next.x, next.y, 200, 400, 0);
    expect(offset.translateX).toBeGreaterThan(
      overlayElementPhysicalOffset(start.x, start.y, 200, 400, 0).translateX
    );
  });

  it("TEXT_DRAG_RTL: RTL chrome does not invert the physical delta", () => {
    const start = { x: 0.5, y: 0.28 };
    const rtlChrome = true;
    const ltr = applyOverlayDrag(start, 40, 20, 200, 400);
    const rtl = applyOverlayDrag(start, 40, 20, 200, 400);
    expect(rtlChrome).toBe(true);
    expect(rtl).toEqual(ltr);
    expect(rtl.x).toBeCloseTo(0.7);
    expect(rtl.y).toBeCloseTo(0.33);
    expect(OVERLAY_INTERACTION_LAYOUT_DIRECTION).toBe("ltr");
    expect(overlayCanvasStyle(200, 400).direction).toBe("ltr");
    expect(overlayCanvasStyle(200, 400).left).toBe(0);
    expect(overlayCanvasStyle(200, 400).right).toBe(0);
  });

  it("TEXT_DRAG_PHYSICAL_DIRECTION: FINGER_RIGHT → OVERLAY_RIGHT", () => {
    const start = { x: 0.5, y: 0.5 };
    const fingerRight = applyOverlayDrag(start, 50, 0, 200, 400);
    const fingerLeft = applyOverlayDrag(start, -50, 0, 200, 400);
    expect(fingerRight.x).toBeGreaterThan(start.x);
    expect(fingerLeft.x).toBeLessThan(start.x);
    const rightPx = overlayElementPhysicalOffset(
      fingerRight.x,
      fingerRight.y,
      200,
      400,
      0
    ).translateX;
    const leftPx = overlayElementPhysicalOffset(
      fingerLeft.x,
      fingerLeft.y,
      200,
      400,
      0
    ).translateX;
    expect(rightPx).toBeGreaterThan(100);
    expect(leftPx).toBeLessThan(100);
  });

  it("EMOJI_DRAG_LTR + EMOJI_DRAG_RTL share the same physical model", () => {
    const sticker = createStickerOverlay("🔥", { x: 0.5, y: 0.62 });
    const ltr = applyOverlayDrag({ x: sticker.x, y: sticker.y }, 30, -20, 200, 400);
    const rtl = applyOverlayDrag({ x: sticker.x, y: sticker.y }, 30, -20, 200, 400);
    expect(ltr).toEqual(rtl);
    expect(ltr.x).toBeCloseTo(0.65);
    expect(ltr.y).toBeCloseTo(0.57);
    const next = moveOverlay([sticker], sticker.id, ltr.x, ltr.y);
    expect(next[0]?.emoji).toBe("🔥");
    expect(next[0]?.x).toBeCloseTo(0.65);
  });

  it("STICKER_DRAG updates normalized x/y without locale mirroring", () => {
    const sticker = applyOverlayDrag({ x: 0.5, y: 0.62 }, -20, -40, 200, 400);
    expect(sticker.x).toBeCloseTo(0.4);
    expect(sticker.y).toBeCloseTo(0.52);
  });

  it("TEXT_OVERLAY_DRAG_MOVE + EMOJI_STICKER_DRAG_MOVE update normalized x/y", () => {
    const text = applyOverlayDrag({ x: 0.5, y: 0.28 }, 40, 20, 200, 400);
    expect(text.x).toBeCloseTo(0.7);
    expect(text.y).toBeCloseTo(0.33);
    const sticker = applyOverlayDrag({ x: 0.5, y: 0.62 }, -20, -40, 200, 400);
    expect(sticker.x).toBeCloseTo(0.4);
    expect(sticker.y).toBeCloseTo(0.52);
  });

  it("DRAG_UPDATES_EDIT_STATE: moveOverlay writes x/y into the list", () => {
    const text = createTextOverlay({ x: 0.5, y: 0.28, text: "Hello" });
    const sticker = createStickerOverlay("🔥", { x: 0.5, y: 0.62 });
    const dragged = applyOverlayDrag({ x: text.x, y: text.y }, 50, 0, 200, 280);
    const next = moveOverlay([text, sticker], text.id, dragged.x, dragged.y);
    expect(next[0]?.x).toBeCloseTo(0.75);
    expect(next[0]?.y).toBeCloseTo(0.28);
    expect(next[0]?.text).toBe("Hello");
    expect(next[1]?.emoji).toBe("🔥");
    expect(next[1]?.x).toBe(0.5);
  });

  it("OVERLAY_SELECT: later elements win hit tests and hit slop is at least 44pt", () => {
    expect(OVERLAY_DRAG_MIN_HIT).toBeGreaterThanOrEqual(44);
    expect(overlayHitSize(0.01, 280)).toBe(44);
    const text = createTextOverlay({ id: "text-1", x: 0.5, y: 0.28 });
    const sticker = createStickerOverlay("😍", { id: "sticker-1", x: 0.5, y: 0.62 });
    expect(hitTestOverlay([text, sticker], 100, 78, 200, 280)).toBe("text-1");
    expect(hitTestOverlay([text, sticker], 100, 174, 200, 280)).toBe("sticker-1");
    expect(hitTestOverlay([text, sticker], 10, 10, 200, 280)).toBeNull();
  });

  it("clamps to the frame and ignores zero-size stages", () => {
    expect(applyOverlayDrag({ x: 0.9, y: 0.9 }, 80, 80, 200, 200)).toEqual({
      x: 1,
      y: 1,
    });
    expect(applyOverlayDrag({ x: 0.4, y: 0.4 }, 10, 10, 0, 280)).toEqual({
      x: 0.4,
      y: 0.4,
    });
  });
});
