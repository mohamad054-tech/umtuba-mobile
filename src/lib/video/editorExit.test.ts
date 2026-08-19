import { describe, expect, it } from "vitest";

import { detectDeviceLocale, SUPPORTED_LOCALES } from "@/src/lib/i18n/locales";
import { MESSAGE_CATALOGS } from "@/src/lib/i18n/messages/catalogs";
import { enMessages } from "@/src/lib/i18n/messages/en";
import { createTextOverlay } from "@/src/lib/video/videoOverlays";
import { createInitialEditState } from "@/src/lib/video/videoEditState";

import {
  closeEditorPreservingDraft,
  createEditorExitGuard,
  EDITOR_FOOTER_CTA_MIN_HEIGHT,
  EDITOR_HEADER_ACTION_MIN_HEIGHT,
  editorFooterPaddingBottom,
  isPrimaryEditorExit,
  preservesEditStateOnExit,
} from "./editorExit";

describe("EDITOR_EXIT", () => {
  it("FOOTER_CTA_VISIBLE: primary footer is at least 44pt with safe-area pad", () => {
    expect(EDITOR_FOOTER_CTA_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
    expect(EDITOR_HEADER_ACTION_MIN_HEIGHT).toBeGreaterThanOrEqual(44);
    expect(editorFooterPaddingBottom(34)).toBe(34);
    expect(editorFooterPaddingBottom(0)).toBeGreaterThanOrEqual(12);
    expect(editorFooterPaddingBottom(-8)).toBeGreaterThanOrEqual(12);
  });

  it("SAFE_AREA: iPhone 13 home-indicator inset is applied, not clipped", () => {
    expect(editorFooterPaddingBottom(34)).toBe(34);
    expect(editorFooterPaddingBottom(20)).toBe(20);
  });

  it("DOUBLE_TAP_GUARD: second Continue is ignored", () => {
    const guard = createEditorExitGuard();
    expect(guard.requestContinue()).toBe(true);
    expect(guard.requestContinue()).toBe(false);
    expect(guard.requestContinue()).toBe(false);
    expect(guard.isCommitted()).toBe(true);
    guard.reset();
    expect(guard.requestContinue()).toBe(true);
  });

  it("EDIT_STATE_PRESERVED + PUBLISH_FLOW_VISIBLE: Continue closes without wiping draft", () => {
    const overlay = createTextOverlay({ text: "مرحبا" });
    const draft = {
      ...createInitialEditState(8_000),
      trimStartMs: 500,
      trimEndMs: 4_000,
      overlays: [overlay],
      soundId: "sound-1",
      originalAudioVolume: 0.5,
      mix: {
        ...createInitialEditState(8_000).mix,
        originalAudioEnabled: true,
        originalAudioVolume: 0.5,
        addedSoundVolume: 0.8,
      },
    };
    expect(preservesEditStateOnExit("continue")).toBe(true);
    expect(preservesEditStateOnExit("back")).toBe(true);
    expect(isPrimaryEditorExit("continue")).toBe(true);
    expect(isPrimaryEditorExit("back")).toBe(false);
    const next = closeEditorPreservingDraft(draft);
    expect(next.editorOpen).toBe(false);
    expect(next.publishFlowVisible).toBe(true);
    expect(next.draft).toBe(draft);
    expect(next.draft.overlays[0]?.text).toBe("مرحبا");
    expect(next.draft.soundId).toBe("sound-1");
    expect(next.draft.trimStartMs).toBe(500);
    expect(next.draft.originalAudioVolume).toBe(0.5);
    expect(next.draft.mix.addedSoundVolume).toBe(0.8);
  });

  it("ARABIC_RTL + LOCALIZATION: Continue is localized in every mobile catalog", () => {
    expect(SUPPORTED_LOCALES).toEqual(["ar", "en", "fr", "es", "de", "pt"]);
    expect(enMessages["create.editorContinue"]).toBe("Continue");
    expect(MESSAGE_CATALOGS.ar["create.editorContinue"]).toBe("متابعة");
    expect(MESSAGE_CATALOGS.de["create.editorContinue"]).toBe("Weiter");
    expect(MESSAGE_CATALOGS.fr["create.editorContinue"]).not.toBe(
      enMessages["create.editorContinue"]
    );
    for (const locale of SUPPORTED_LOCALES) {
      expect(MESSAGE_CATALOGS[locale]["create.editorContinue"].trim().length).toBeGreaterThan(0);
      expect(MESSAGE_CATALOGS[locale]["create.editorDone"].trim().length).toBeGreaterThan(0);
      expect(MESSAGE_CATALOGS[locale]["create.editorContinueHint"].trim().length).toBeGreaterThan(
        0
      );
    }
  });

  it("preserves the existing 6-locale mobile contract for the extra web locales", () => {
    expect(detectDeviceLocale("pt-BR")).toBe("pt");
    expect(detectDeviceLocale("id")).toBe("en");
    expect(detectDeviceLocale("hi")).toBe("en");
    expect(detectDeviceLocale("ru")).toBe("en");
    expect(detectDeviceLocale("tr")).toBe("en");
    expect(detectDeviceLocale("zh-CN")).toBe("en");
    expect(detectDeviceLocale("ja")).toBe("en");
    expect(detectDeviceLocale("ko")).toBe("en");
    expect(MESSAGE_CATALOGS.en["create.editorContinue"]).toBe("Continue");
  });
});
