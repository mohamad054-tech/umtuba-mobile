/**
 * Editor-local keyboard completion. Header Done / footer Continue exit the
 * editor; this path only blurs, dismisses the keyboard, and commits text.
 */

import {
  addOverlay,
  createTextOverlay,
  updateOverlay,
  type VideoOverlayElement,
} from "@/src/lib/video/videoOverlays";

export const EDITOR_TEXT_INPUT_ACCESSORY_ID = "umtubaEditorTextDone";

export type EditorKeyboardDismissIntent = "local-done" | "submit" | "blur";

export type EditorTextCommitInput = {
  textDraft: string;
  selected: VideoOverlayElement | null;
  overlays: VideoOverlayElement[];
};

export type EditorTextCommitResult = {
  overlays: VideoOverlayElement[];
  selectedId: string | null;
  textDraft: string;
  textPreserved: boolean;
  editorStaysOpen: true;
  controlsRestored: true;
  continueTriggered: false;
  publishTriggered: false;
  discardTriggered: false;
};

export function isEditorLocalKeyboardDone(
  intent: EditorKeyboardDismissIntent
): boolean {
  return intent === "local-done" || intent === "submit";
}

export function editorLocalDoneLeavesEditor(): boolean {
  return false;
}

export function editorLocalDoneTriggersContinue(): boolean {
  return false;
}

export function editorLocalDoneTriggersPublish(): boolean {
  return false;
}

export function commitEditorTextOnDismiss(
  input: EditorTextCommitInput
): EditorTextCommitResult {
  const draft = typeof input.textDraft === "string" ? input.textDraft.trim() : "";
  const selected = input.selected;
  const overlays = input.overlays;

  if (!draft) {
    return {
      overlays,
      selectedId: selected?.id ?? null,
      textDraft: "",
      textPreserved: overlays.some((el) => el.kind === "text" && Boolean(el.text)),
      editorStaysOpen: true,
      controlsRestored: true,
      continueTriggered: false,
      publishTriggered: false,
      discardTriggered: false,
    };
  }

  if (selected?.kind === "text") {
    const next = updateOverlay(overlays, selected.id, { text: draft });
    const updated = next.find((el) => el.id === selected.id);
    return {
      overlays: next,
      selectedId: selected.id,
      textDraft: "",
      textPreserved: Boolean(updated?.text),
      editorStaysOpen: true,
      controlsRestored: true,
      continueTriggered: false,
      publishTriggered: false,
      discardTriggered: false,
    };
  }

  const el = createTextOverlay({ text: draft, y: 0.28 });
  return {
    overlays: addOverlay(overlays, el),
    selectedId: el.id,
    textDraft: "",
    textPreserved: Boolean(el.text),
    editorStaysOpen: true,
    controlsRestored: true,
    continueTriggered: false,
    publishTriggered: false,
    discardTriggered: false,
  };
}
