import { describe, expect, it } from "vitest";

import {
  applyOverlayDrag,
  hitTestOverlay,
  overlayHitSize,
  OVERLAY_DRAG_MIN_HIT,
} from "./overlayDrag";
import {
  createStickerOverlay,
  createTextOverlay,
  moveOverlay,
} from "./videoOverlays";

describe("OVERLAY_DRAG", () => {
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
