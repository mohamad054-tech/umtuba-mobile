import {
  CREATE_UPLOAD_CANCELLED_MESSAGE,
  CREATE_UPLOAD_FAILED_MESSAGE,
  CREATE_PUBLISH_FAILED_MESSAGE,
  clampUploadPercent,
  isAbortError,
  processingProgressAfterUpload,
  processingProgressOnReady,
  processingProgressWhilePublishing,
  type CreateProgressPhase,
} from "@/src/lib/video/createProgress";

export type CreateAttemptBinding = {
  attemptId: string;
  assetId: string;
};

export type CreateJourneyState = {
  phase: CreateProgressPhase;
  uploadPercent: number;
  processingPercent: number | null;
  message: string | null;
  error: string | null;
  uploadedPath: string | null;
  publishedPostId: number | null;
  publishBusy: boolean;
  uploadBusy: boolean;
  attemptId: string | null;
  boundAssetId: string | null;
  rejectedAssetLabel: string | null;
};

export function normalizePublishedPostId(
  postId: number | null | undefined
): number | null {
  if (typeof postId !== "number" || !Number.isInteger(postId) || postId <= 0) {
    return null;
  }
  return postId;
}

/** Watch already focuses `?post=` — Open Watch must pass the published id. */
export function openWatchAfterPublishHref(
  postId: number | null | undefined
): string {
  const id = normalizePublishedPostId(postId);
  return id ? `/(tabs)/watch?post=${id}` : "/(tabs)/watch";
}

export function initialCreateJourneyState(): CreateJourneyState {
  return {
    phase: "ready",
    uploadPercent: 0,
    processingPercent: null,
    message: null,
    error: null,
    uploadedPath: null,
    publishedPostId: null,
    publishBusy: false,
    uploadBusy: false,
    attemptId: null,
    boundAssetId: null,
    rejectedAssetLabel: null,
  };
}

/** Prevents starting a second upload/publish while one is in flight. */
export function canStartUpload(state: CreateJourneyState): boolean {
  return !state.uploadBusy && !state.publishBusy;
}

export function canStartPublish(state: CreateJourneyState): boolean {
  return !state.uploadBusy && !state.publishBusy;
}

export function beginUpload(
  state: CreateJourneyState,
  binding?: CreateAttemptBinding
): CreateJourneyState | null {
  if (!canStartUpload(state)) return null;
  return {
    ...state,
    phase: "uploading",
    uploadBusy: true,
    publishBusy: false,
    uploadPercent: 0,
    processingPercent: null,
    error: null,
    message: "Uploading…",
    uploadedPath: null,
    publishedPostId: null,
    attemptId: binding?.attemptId ?? null,
    boundAssetId: binding?.assetId ?? null,
    rejectedAssetLabel: null,
  };
}

export function applyUploadProgress(
  state: CreateJourneyState,
  percent: number
): CreateJourneyState {
  if (state.phase !== "uploading") return state;
  return {
    ...state,
    uploadPercent: clampUploadPercent(percent),
  };
}

export function completeUpload(
  state: CreateJourneyState,
  path: string
): CreateJourneyState {
  const next = processingProgressAfterUpload();
  return {
    ...state,
    phase: next.phase,
    uploadPercent: next.uploadPercent,
    processingPercent: next.processingPercent,
    uploadBusy: false,
    publishBusy: true,
    uploadedPath: path,
    message: "Upload complete. Publishing your video…",
    error: null,
  };
}

export function beginPublishing(state: CreateJourneyState): CreateJourneyState {
  const next = processingProgressWhilePublishing();
  return {
    ...state,
    phase: next.phase,
    processingPercent: next.processingPercent,
    publishBusy: true,
    message: "Publishing your video…",
  };
}

export function completePublish(
  state: CreateJourneyState,
  postId?: number | null
): CreateJourneyState {
  const next = processingProgressOnReady();
  return {
    ...state,
    phase: next.phase,
    processingPercent: next.processingPercent,
    publishBusy: false,
    uploadBusy: false,
    message: "Video published.",
    error: null,
    uploadedPath: null,
    attemptId: null,
    boundAssetId: null,
    rejectedAssetLabel: null,
    publishedPostId: normalizePublishedPostId(postId),
  };
}

export function failJourney(
  state: CreateJourneyState,
  error: unknown,
  fallback: string
): CreateJourneyState {
  if (isAbortError(error)) {
    return {
      ...state,
      phase: "error",
      uploadBusy: false,
      publishBusy: false,
      error: CREATE_UPLOAD_CANCELLED_MESSAGE,
      message: null,
    };
  }
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : fallback;
  return {
    ...state,
    phase: "error",
    uploadBusy: false,
    publishBusy: false,
    error: message,
    message: null,
  };
}

export function failUpload(state: CreateJourneyState, error: unknown): CreateJourneyState {
  return failJourney(state, error, CREATE_UPLOAD_FAILED_MESSAGE);
}

export function failPublish(state: CreateJourneyState, error: unknown): CreateJourneyState {
  return failJourney(state, error, CREATE_PUBLISH_FAILED_MESSAGE);
}

export function retryFromError(state: CreateJourneyState): CreateJourneyState {
  return {
    ...initialCreateJourneyState(),
    uploadedPath: null,
    publishedPostId: null,
    attemptId: null,
    boundAssetId: state.boundAssetId,
    error: null,
  };
}
