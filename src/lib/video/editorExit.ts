/**
 * Shared Create editor exit contract (iOS + Android).
 * Footer Continue is the primary commit; Back keeps draft-protection.
 */

export const EDITOR_FOOTER_CTA_MIN_HEIGHT = 48;
export const EDITOR_HEADER_ACTION_MIN_HEIGHT = 44;
export const EDITOR_FOOTER_MIN_BOTTOM_PAD = 12;

export type EditorExitIntent = "continue" | "back";

export function editorFooterPaddingBottom(safeAreaBottom: number): number {
  const inset = Number.isFinite(safeAreaBottom) ? Math.max(0, safeAreaBottom) : 0;
  return Math.max(inset, EDITOR_FOOTER_MIN_BOTTOM_PAD);
}

export function createEditorExitGuard() {
  let committed = false;
  return {
    requestContinue(): boolean {
      if (committed) return false;
      committed = true;
      return true;
    },
    reset(): void {
      committed = false;
    },
    isCommitted(): boolean {
      return committed;
    },
  };
}

export function preservesEditStateOnExit(intent: EditorExitIntent): boolean {
  return intent === "continue" || intent === "back";
}

export function isPrimaryEditorExit(intent: EditorExitIntent): boolean {
  return intent === "continue";
}

export function closeEditorPreservingDraft<TDraft>(draft: TDraft): {
  draft: TDraft;
  editorOpen: false;
  publishFlowVisible: true;
} {
  return {
    draft,
    editorOpen: false,
    publishFlowVisible: true,
  };
}
