import { describe, expect, it } from "vitest";

import {
  commitEditorTextOnDismiss,
  EDITOR_TEXT_INPUT_ACCESSORY_ID,
  editorLocalDoneLeavesEditor,
  editorLocalDoneTriggersContinue,
  editorLocalDoneTriggersPublish,
  isEditorLocalKeyboardDone,
} from "./editorKeyboard";
import { createStickerOverlay, createTextOverlay } from "./videoOverlays";

describe("EDITOR_KEYBOARD", () => {
  it("KEYBOARD_LOCAL_DONE commits text without exiting or publishing", () => {
    expect(isEditorLocalKeyboardDone("local-done")).toBe(true);
    expect(isEditorLocalKeyboardDone("submit")).toBe(true);
    expect(isEditorLocalKeyboardDone("blur")).toBe(false);
    expect(editorLocalDoneLeavesEditor()).toBe(false);
    expect(editorLocalDoneTriggersContinue()).toBe(false);
    expect(editorLocalDoneTriggersPublish()).toBe(false);
    expect(EDITOR_TEXT_INPUT_ACCESSORY_ID.length).toBeGreaterThan(0);

    const result = commitEditorTextOnDismiss({
      textDraft: "مرحبا",
      selected: null,
      overlays: [],
    });
    expect(result.editorStaysOpen).toBe(true);
    expect(result.continueTriggered).toBe(false);
    expect(result.publishTriggered).toBe(false);
    expect(result.discardTriggered).toBe(false);
    expect(result.controlsRestored).toBe(true);
    expect(result.overlays[0]?.text).toBe("مرحبا");
    expect(result.textPreserved).toBe(true);
    expect(result.textDraft).toBe("");
  });

  it("KEYBOARD_BLUR with empty draft keeps existing overlays", () => {
    const existing = createTextOverlay({ text: "Hello" });
    const result = commitEditorTextOnDismiss({
      textDraft: "   ",
      selected: existing,
      overlays: [existing],
    });
    expect(result.overlays[0]?.text).toBe("Hello");
    expect(result.selectedId).toBe(existing.id);
    expect(result.textPreserved).toBe(true);
    expect(result.editorStaysOpen).toBe(true);
  });

  it("EDITOR_STAYS_OPEN + EDITOR_CONTROLS_RESTORED after local Done", () => {
    const result = commitEditorTextOnDismiss({
      textDraft: "Stay",
      selected: null,
      overlays: [],
    });
    expect(result.editorStaysOpen).toBe(true);
    expect(result.controlsRestored).toBe(true);
    expect(result.continueTriggered).toBe(false);
  });

  it("TEXT_PRESERVED_AFTER_BLUR updates a selected text overlay", () => {
    const existing = createTextOverlay({ text: "old" });
    const result = commitEditorTextOnDismiss({
      textDraft: "new text",
      selected: existing,
      overlays: [existing],
    });
    expect(result.overlays).toHaveLength(1);
    expect(result.overlays[0]?.text).toBe("new text");
    expect(result.selectedId).toBe(existing.id);
    expect(result.textPreserved).toBe(true);
  });

  it("does not turn a sticker selection into discarded text", () => {
    const sticker = createStickerOverlay("😍");
    const result = commitEditorTextOnDismiss({
      textDraft: "caption",
      selected: sticker,
      overlays: [sticker],
    });
    expect(result.overlays).toHaveLength(2);
    expect(result.overlays[0]?.emoji).toBe("😍");
    expect(result.overlays[1]?.text).toBe("caption");
    expect(result.discardTriggered).toBe(false);
  });
});
