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

export type CreateJourneyState = {
  phase: CreateProgressPhase;
  uploadPercent: number;
  processingPercent: number | null;
  message: string | null;
  error: string | null;
  uploadedPath: string | null;
  publishBusy: boolean;
  uploadBusy: boolean;
};

export function initialCreateJourneyState(): CreateJourneyState {
  return {
    phase: "ready",
    uploadPercent: 0,
    processingPercent: null,
    message: null,
    error: null,
    uploadedPath: null,
    publishBusy: false,
    uploadBusy: false,
  };
}

/** Prevents starting a second upload/publish while one is in flight. */
export function canStartUpload(state: CreateJourneyState): boolean {
  return !state.uploadBusy && !state.publishBusy;
}

export function canStartPublish(state: CreateJourneyState): boolean {
  return !state.uploadBusy && !state.publishBusy;
}

export function beginUpload(state: CreateJourneyState): CreateJourneyState | null {
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

export function completePublish(state: CreateJourneyState): CreateJourneyState {
  const next = processingProgressOnReady();
  return {
    ...state,
    phase: next.phase,
    processingPercent: next.processingPercent,
    publishBusy: false,
    uploadBusy: false,
    message: "Video published.",
    error: null,
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
    error: null,
  };
}
