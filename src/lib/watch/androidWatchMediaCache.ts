import { setVideoCacheSizeAsync } from "expo-video";

/** Bounded Media3 disk cache for Android Watch. LRU, not a gallery download. */
export const ANDROID_WATCH_VIDEO_CACHE_BYTES = 192 * 1024 * 1024;

export const ANDROID_WATCH_FORWARD_BUFFER_SECONDS = 8;
export const ANDROID_WATCH_MIN_BUFFER_SECONDS = 1;
export const ANDROID_WATCH_MAX_BUFFER_BYTES = 12 * 1024 * 1024;

export type AndroidWatchBufferOptions = {
  preferredForwardBufferDuration: number;
  minBufferForPlayback: number;
  maxBufferBytes: number;
  prioritizeTimeOverSizeThreshold: boolean;
};

export function resolveAndroidWatchBufferOptions(
  platform: string | null | undefined
): AndroidWatchBufferOptions | null {
  if (platform !== "android") return null;
  return {
    preferredForwardBufferDuration: ANDROID_WATCH_FORWARD_BUFFER_SECONDS,
    minBufferForPlayback: ANDROID_WATCH_MIN_BUFFER_SECONDS,
    maxBufferBytes: ANDROID_WATCH_MAX_BUFFER_BYTES,
    prioritizeTimeOverSizeThreshold: true,
  };
}

let configured = false;

export async function ensureAndroidWatchVideoCache(
  platform: string | null | undefined
): Promise<boolean> {
  if (platform !== "android" || configured) return configured;
  try {
    await setVideoCacheSizeAsync(ANDROID_WATCH_VIDEO_CACHE_BYTES);
    configured = true;
    return true;
  } catch {
    return false;
  }
}
