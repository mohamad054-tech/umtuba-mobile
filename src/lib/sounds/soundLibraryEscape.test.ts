import { describe, expect, it } from "vitest";

import { MESSAGE_CATALOGS } from "@/src/lib/i18n/messages/catalogs";
import { SUPPORTED_LOCALES } from "@/src/lib/i18n/locales";
import { createInitialEditState } from "@/src/lib/video/videoEditState";
import { createTextOverlay } from "@/src/lib/video/videoOverlays";

import {
  closeSoundLibraryPreservingEditor,
  shouldInterceptEditorBackForSoundLibrary,
  SOUND_LIBRARY_HEADER_ACTION_MIN_HEIGHT,
  SOUND_LIBRARY_IPHONE_NOTCH_FALLBACK_TOP,
  soundLibraryChromeVisible,
  soundLibraryTopInset,
  soundLibraryUsesNestedModal,
  type SoundLibraryPhase,
} from "./soundLibraryEscape";

const PHASES: SoundLibraryPhase[] = ["loading", "ready", "empty", "error"];

describe("SOUND_LIBRARY_BACK_CLOSE", () => {
  it("exposes Back/Close chrome in every library phase", () => {
    for (const phase of PHASES) {
      expect(soundLibraryChromeVisible(phase)).toBe(true);
    }
    expect(SOUND_LIBRARY_HEADER_ACTION_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
  });

  it("LOADING_ESCAPE + EMPTY_ESCAPE + ERROR_ESCAPE keep the same chrome contract", () => {
    expect(soundLibraryChromeVisible("loading")).toBe(true);
    expect(soundLibraryChromeVisible("empty")).toBe(true);
    expect(soundLibraryChromeVisible("error")).toBe(true);
  });

  it("uses an in-editor overlay, not a nested iOS Modal", () => {
    expect(soundLibraryUsesNestedModal()).toBe(false);
  });

  it("pads below the iPhone notch when Modal insets collapse to 0", () => {
    expect(soundLibraryTopInset(47, "ios")).toBe(47);
    expect(soundLibraryTopInset(0, "ios")).toBe(
      SOUND_LIBRARY_IPHONE_NOTCH_FALLBACK_TOP
    );
    expect(soundLibraryTopInset(12, "ios")).toBe(
      SOUND_LIBRARY_IPHONE_NOTCH_FALLBACK_TOP
    );
    expect(soundLibraryTopInset(0, "android")).toBe(12);
    expect(soundLibraryTopInset(24, "android")).toBe(24);
  });

  it("EDITOR_STATE_PRESERVED: Back/Close return to the current editor", () => {
    const overlay = createTextOverlay({ text: "مرحبا" });
    const draft = {
      ...createInitialEditState(8_000),
      overlays: [overlay],
      soundId: "keep-me",
      trimStartMs: 400,
    };
    const selectedSound = { id: "keep-me", title: "Mine" };
    expect(shouldInterceptEditorBackForSoundLibrary(true)).toBe(true);
    expect(shouldInterceptEditorBackForSoundLibrary(false)).toBe(false);
    const next = closeSoundLibraryPreservingEditor({ draft, selectedSound });
    expect(next.soundLibraryOpen).toBe(false);
    expect(next.editorOpen).toBe(true);
    expect(next.draft).toBe(draft);
    expect(next.draft.overlays[0]?.text).toBe("مرحبا");
    expect(next.draft.soundId).toBe("keep-me");
    expect(next.selectedSound).toBe(selectedSound);
  });

  it("localizes Back and Close in every mobile catalog", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(MESSAGE_CATALOGS[locale]["actions.back"].trim().length).toBeGreaterThan(
        0
      );
      expect(
        MESSAGE_CATALOGS[locale]["actions.close"].trim().length
      ).toBeGreaterThan(0);
      expect(
        MESSAGE_CATALOGS[locale]["create.soundLibrary"].trim().length
      ).toBeGreaterThan(0);
      expect(
        MESSAGE_CATALOGS[locale]["create.noLicensedSounds"].trim().length
      ).toBeGreaterThan(0);
    }
  });
});
