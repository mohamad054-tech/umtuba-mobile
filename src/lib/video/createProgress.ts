/**
 * Create Video progress honesty helpers (Media Pipeline V1).
 * Upload percent is real; processing must not fake jumps to 100%.
 */

export type CreateProgressPhase =
  | "idle"
  | "checking-auth"
  | "ready"
  | "picking"
  | "uploading"
  | "queued"
  | "processing"
  | "success"
  | "error";

export const CREATE_UPLOAD_COMPLETE_MESSAGE =
  "Upload complete. Publishing your video…";
export const CREATE_PROCESSING_MESSAGE = "Publishing your video…";
export const CREATE_SUCCESS_MESSAGE = "Video published.";
export const CREATE_PUBLISH_FAILED_MESSAGE =
  "The video could not be published. Please try again.";
export const CREATE_UPLOAD_CANCELLED_MESSAGE = "Upload cancelled.";
export const CREATE_UPLOAD_FAILED_MESSAGE =
  "The video could not be uploaded. Please try again.";

export function processingProgressAfterUpload(): {
  phase: "queued";
  uploadPercent: 100;
  processingPercent: null;
} {
  return {
    phase: "queued",
    uploadPercent: 100,
    processingPercent: null,
  };
}

export function processingProgressWhilePublishing(): {
  phase: "processing";
  processingPercent: null;
} {
  return {
    phase: "processing",
    processingPercent: null,
  };
}

export function processingProgressOnReady(): {
  phase: "success";
  processingPercent: 100;
} {
  return {
    phase: "success",
    processingPercent: 100,
  };
}

export function clampUploadPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function createAbortError(message = "Upload cancelled."): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

export function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    return (
      error.name === "AbortError" ||
      /abort|cancel/i.test(error.message)
    );
  }
  return false;
}
