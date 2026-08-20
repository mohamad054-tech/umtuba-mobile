/**
 * Sound Library must never trap the Create editor.
 * Back/Close stays visible in every load phase; closing returns to the
 * current editor without wiping media, overlays, or mix state.
 */

export const SOUND_LIBRARY_HEADER_ACTION_MIN_HEIGHT = 44;
export const SOUND_LIBRARY_IPHONE_NOTCH_FALLBACK_TOP = 47;

export type SoundLibraryPhase = "loading" | "ready" | "empty" | "error";

export function soundLibraryChromeVisible(_phase: SoundLibraryPhase): true {
  return true;
}

export function soundLibraryTopInset(
  safeAreaTop: number,
  platform: string
): number {
  const inset = Number.isFinite(safeAreaTop) ? Math.max(0, safeAreaTop) : 0;
  if (platform === "ios" && inset < 20) {
    return SOUND_LIBRARY_IPHONE_NOTCH_FALLBACK_TOP;
  }
  return Math.max(inset, 12);
}

export function shouldInterceptEditorBackForSoundLibrary(
  soundLibraryOpen: boolean
): boolean {
  return soundLibraryOpen === true;
}

export function closeSoundLibraryPreservingEditor<TDraft, TSound>(input: {
  draft: TDraft;
  selectedSound: TSound;
}): {
  soundLibraryOpen: false;
  editorOpen: true;
  draft: TDraft;
  selectedSound: TSound;
} {
  return {
    soundLibraryOpen: false,
    editorOpen: true,
    draft: input.draft,
    selectedSound: input.selectedSound,
  };
}

export function soundLibraryUsesNestedModal(): false {
  return false;
}
