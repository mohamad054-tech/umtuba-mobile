import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isOwnedVideoPath,
  newUploadFileId,
  POST_VIDEOS_BUCKET,
  validateVideoFile,
  VIDEO_UPLOAD_TIMEOUT_MS,
  videoExtensionForMime,
} from "@/src/contracts/video";
import { getErrorMessage } from "@/src/contracts/validation";
import { getEnv } from "@/src/lib/env";
import { clampUploadPercent, createAbortError } from "@/src/lib/video/createProgress";

export type UploadPostVideoProgress = {
  percent: number;
  loaded: number;
  total: number;
};

export type UploadPostVideoResult = {
  path: string;
  mimeType: string;
  byteSize: number;
};

export type UploadPostVideoInput = {
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  userId: string;
  accessToken: string;
  onProgress?: (progress: UploadPostVideoProgress) => void;
  signal?: AbortSignal;
};

/**
 * Authenticated upload into private post-videos/{userId}/…
 * Uses XHR for progress + AbortSignal cancel + timeout (matches web).
 * Does not mint signed upload URLs — JWT bearer auth only.
 */
export async function uploadPostVideo(
  input: UploadPostVideoInput
): Promise<UploadPostVideoResult> {
  const fileCheck = validateVideoFile({
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    fileName: input.fileName,
  });

  if (!fileCheck.ok) {
    throw new Error(fileCheck.message);
  }

  const mimeType = fileCheck.mimeType;
  const extension = videoExtensionForMime(mimeType);
  const filePath = `${input.userId}/${newUploadFileId()}.${extension}`;

  if (!isOwnedVideoPath(input.userId, filePath)) {
    throw new Error("Invalid video upload path.");
  }

  if (!input.accessToken) {
    throw new Error("Please sign in to upload a video.");
  }

  if (input.signal?.aborted) {
    throw createAbortError();
  }

  const body = await readUriAsBlob(input.uri);
  await uploadWithProgressXhr({
    body,
    filePath,
    mimeType,
    byteSize: input.byteSize,
    accessToken: input.accessToken,
    onProgress: input.onProgress,
    signal: input.signal,
  });

  return {
    path: filePath,
    mimeType,
    byteSize: input.byteSize,
  };
}

async function readUriAsBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Unable to read the selected video file.");
  }
  const blob = await response.blob();
  if (!blob || blob.size <= 0) {
    throw new Error("The selected video file is empty.");
  }
  return blob;
}

async function uploadWithProgressXhr(input: {
  body: Blob;
  filePath: string;
  mimeType: string;
  byteSize: number;
  accessToken: string;
  onProgress?: (progress: UploadPostVideoProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { supabaseUrl, supabasePublishableKey } = getEnv();
  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${POST_VIDEOS_BUCKET}/${input.filePath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.timeout = VIDEO_UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader("apikey", supabasePublishableKey);
    xhr.setRequestHeader("Authorization", `Bearer ${input.accessToken}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("content-type", input.mimeType);

    const onAbort = () => {
      xhr.abort();
    };
    input.signal?.addEventListener("abort", onAbort);

    const settle = (fn: () => void) => {
      input.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    xhr.upload.onprogress = (event) => {
      if (!input.onProgress) return;
      if (!event.lengthComputable || event.total <= 0) {
        input.onProgress({
          percent: 0,
          loaded: event.loaded,
          total: input.byteSize,
        });
        return;
      }
      input.onProgress({
        percent: clampUploadPercent((event.loaded / event.total) * 100),
        loaded: event.loaded,
        total: event.total,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress?.({
          percent: 100,
          loaded: input.byteSize,
          total: input.byteSize,
        });
        settle(() => resolve());
        return;
      }
      console.error("Unable to upload video:", xhr.status, xhr.responseText);
      const message =
        xhr.status === 413
          ? "The video is too large to upload."
          : xhr.status === 401 || xhr.status === 403
            ? "Please sign in to upload a video."
            : "Unable to upload video. Please try again.";
      settle(() => reject(new Error(message)));
    };

    xhr.onerror = () => {
      settle(() =>
        reject(
          new Error(
            "Network issue during upload. Check your connection and try again."
          )
        )
      );
    };

    xhr.ontimeout = () => {
      settle(() =>
        reject(
          new Error(
            "Upload timed out. Please try again on a stronger connection."
          )
        )
      );
    };

    xhr.onabort = () => {
      settle(() => reject(createAbortError()));
    };

    xhr.send(input.body);
  });
}

/** Fallback upload without progress (supabase-js). */
export async function uploadPostVideoSimple(
  supabase: SupabaseClient,
  input: {
    uri: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    userId: string;
  }
): Promise<UploadPostVideoResult> {
  const fileCheck = validateVideoFile({
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    fileName: input.fileName,
  });
  if (!fileCheck.ok) {
    throw new Error(fileCheck.message);
  }

  const mimeType = fileCheck.mimeType;
  const filePath = `${input.userId}/${newUploadFileId()}.${videoExtensionForMime(mimeType)}`;
  if (!isOwnedVideoPath(input.userId, filePath)) {
    throw new Error("Invalid video upload path.");
  }

  const body = await readUriAsBlob(input.uri);
  const { error } = await supabase.storage
    .from(POST_VIDEOS_BUCKET)
    .upload(filePath, body, {
      cacheControl: "3600",
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(getErrorMessage(error, "Unable to upload video."));
  }

  return { path: filePath, mimeType, byteSize: input.byteSize };
}
