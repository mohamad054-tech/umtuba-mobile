import { isLocalWatchPlaybackUri } from "@/src/lib/feed/videoStoragePath";

export type WatchEnginePlayerSource = {
  uri: string;
  useCaching: boolean;
};

/** Stable player source. A new object every render must not recreate ExoPlayer. */
export function watchEnginePlayerSource(
  src: string
): WatchEnginePlayerSource {
  const uri = src.trim();
  return {
    uri,
    useCaching: !isLocalWatchPlaybackUri(uri),
  };
}

export function watchEngineSrcSignature(
  videos: readonly { id: string; src?: string | null }[]
): string {
  return videos
    .map((video) => `${video.id}:${(video.src ?? "").trim().slice(-48)}`)
    .join("|");
}
