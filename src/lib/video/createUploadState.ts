/**
 * Create upload draft lifecycle — one selection, one attempt, no stale reuse.
 * Shared by the Create screen; keep in sync with web createVideoState.ts.
 */

import {
  validateCaption,
  validateVideoDuration,
  validateVideoFile,
} from "@/src/contracts/video";
import {
  initialCreateJourneyState,
  type CreateJourneyState,
} from "@/src/lib/video/createJourney";

export type CreateBoundAsset = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  durationMs: number | null;
  width?: number | null;
  height?: number | null;
};

export function createAssetFingerprint(asset: {
  uri: string;
  byteSize: number;
  durationMs: number | null;
  fileName: string;
}): string {
  return [
    asset.uri,
    String(asset.byteSize),
    asset.durationMs == null ? "na" : String(asset.durationMs),
    asset.fileName,
  ].join("|");
}

export function nextCreateAttemptId(assetId: string, nonce: number): string {
  return `${assetId}:${nonce}`;
}

export function isStaleCreateAttempt(
  activeAttemptId: string | null,
  callbackAttemptId: string
): boolean {
  return activeAttemptId !== callbackAttemptId;
}

/** Ignore callbacks that no longer match the live ref or the journey binding. */
export function shouldIgnoreStaleCreateCallback(
  activeAttemptId: string | null,
  stateAttemptId: string | null,
  callbackAttemptId: string
): boolean {
  return (
    isStaleCreateAttempt(activeAttemptId, callbackAttemptId) ||
    isStaleCreateAttempt(stateAttemptId, callbackAttemptId)
  );
}

export type CreateDraftSnapshot<T extends CreateBoundAsset | null> = {
  asset: T;
  caption: string;
  ugcAck: boolean;
  journey: CreateJourneyState;
  activeAttemptId: string | null;
};

export function initialCreateDraft(): CreateDraftSnapshot<null> {
  return {
    asset: null,
    caption: "",
    ugcAck: false,
    journey: initialCreateJourneyState(),
    activeAttemptId: null,
  };
}

/** Opening the picker must not mutate the current valid selection. */
export function beginCreatePick<T extends CreateBoundAsset | null>(
  draft: CreateDraftSnapshot<T>
): CreateDraftSnapshot<T> {
  return draft;
}

/** Cancel leaves the previous valid asset, caption, retry, and journey intact. */
export function applyPickerCancel<T extends CreateBoundAsset | null>(
  draft: CreateDraftSnapshot<T>
): CreateDraftSnapshot<T> {
  return draft;
}

export function applyAtomicAcceptedPick<T extends CreateBoundAsset>(
  draft: CreateDraftSnapshot<CreateBoundAsset | null>,
  nextAsset: T
): CreateDraftSnapshot<T> {
  return {
    asset: nextAsset,
    caption: draft.caption,
    ugcAck: draft.ugcAck,
    journey: applyAcceptedPick(draft.journey),
    activeAttemptId: null,
  };
}

export function applyAtomicRejectedPick(
  draft: CreateDraftSnapshot<CreateBoundAsset | null>,
  message: string,
  rejectedAssetLabel?: string | null
): CreateDraftSnapshot<null> {
  return {
    asset: null,
    caption: draft.caption,
    ugcAck: draft.ugcAck,
    journey: applyRejectedPick(draft.journey, message, rejectedAssetLabel),
    activeAttemptId: null,
  };
}

export function reopenCreateAfterSuccess(
  phase: CreateJourneyState["phase"]
): CreateDraftSnapshot<null> | null {
  if (!shouldResetCreateOnBlur(phase)) {
    return null;
  }
  return initialCreateDraft();
}

export function evaluateCreateAsset(
  asset: CreateBoundAsset | null
): { ok: true } | { ok: false; message: string | null } {
  if (!asset) {
    return { ok: false, message: null };
  }

  const fileCheck = validateVideoFile({
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    fileName: asset.fileName,
  });
  if (!fileCheck.ok) {
    return { ok: false, message: fileCheck.message };
  }

  const durationCheck = validateVideoDuration(asset.durationMs);
  if (!durationCheck.ok) {
    return { ok: false, message: durationCheck.message };
  }

  return { ok: true };
}

export function canPublishCreateDraft(input: {
  asset: CreateBoundAsset | null;
  journey: CreateJourneyState;
  ugcAck: boolean;
  caption: string;
}): boolean {
  if (input.journey.uploadBusy || input.journey.publishBusy) return false;
  if (input.journey.phase === "success") return false;
  if (!input.ugcAck) return false;
  if (!evaluateCreateAsset(input.asset).ok) return false;
  return validateCaption(input.caption).ok;
}

/**
 * Hard publish / upload-start gate. Visual disabled styling is not enough —
 * direct invocation must also refuse an invalid current selection.
 */
export function isCreatePublishActionAllowed(input: {
  asset: CreateBoundAsset | null;
  journey: CreateJourneyState;
  ugcAck: boolean;
  caption: string;
}): boolean {
  return canPublishCreateDraft(input);
}

export function isCreateUploadStartAllowed(input: {
  asset: CreateBoundAsset | null;
  journey: CreateJourneyState;
  ugcAck: boolean;
  caption: string;
}): boolean {
  return isCreatePublishActionAllowed(input);
}

export function applyRejectedPick(
  _state: CreateJourneyState,
  message: string,
  rejectedAssetLabel?: string | null
): CreateJourneyState {
  return {
    ...initialCreateJourneyState(),
    phase: "error",
    error: message,
    rejectedAssetLabel: rejectedAssetLabel?.trim() || null,
  };
}

export function applyAcceptedPick(_state: CreateJourneyState): CreateJourneyState {
  return {
    ...initialCreateJourneyState(),
    phase: "ready",
  };
}

export function resetCreateDraftAfterPublish(): {
  asset: null;
  caption: "";
  ugcAck: false;
  activeAttemptId: null;
} {
  return {
    asset: null,
    caption: "",
    ugcAck: false,
    activeAttemptId: null,
  };
}

export function shouldResetCreateOnBlur(
  phase: CreateJourneyState["phase"]
): boolean {
  return phase === "success";
}

export function bindRetryToCurrentAsset<T extends CreateBoundAsset>(input: {
  asset: T | null;
  journey: CreateJourneyState;
  nonce: number;
}):
  | { ok: true; asset: T; attemptId: string }
  | { ok: false; reason: "no_asset" | "invalid_asset" | "busy" } {
  if (input.journey.uploadBusy || input.journey.publishBusy) {
    return { ok: false, reason: "busy" };
  }
  if (!input.asset) {
    return { ok: false, reason: "no_asset" };
  }
  if (!evaluateCreateAsset(input.asset).ok) {
    return { ok: false, reason: "invalid_asset" };
  }
  return {
    ok: true,
    asset: input.asset,
    attemptId: nextCreateAttemptId(input.asset.id, input.nonce),
  };
}
