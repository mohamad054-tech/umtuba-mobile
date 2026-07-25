import type { WatchVideo } from "@/src/contracts/watch";
import { watchPostDestination } from "@/src/lib/discover/mapDestination";
import type { DiscoverCardModel } from "@/src/lib/discover/types";

function formatViews(views: number): string | null {
  if (!Number.isFinite(views) || views <= 0) return null;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${Math.trunc(views)} views`;
}

/**
 * Adapt an existing Watch feed item into a Discover card.
 * Reuses Watch data only — no invented content.
 */
export function adaptWatchVideoToDiscoverCard(
  video: WatchVideo
): DiscoverCardModel {
  const title =
    (video.title && video.title.trim()) ||
    (video.caption && video.caption.trim()) ||
    "Untitled";
  const subtitle =
    (video.author?.username && video.author.username.trim()) ||
    (video.author?.name && video.author.name.trim()) ||
    null;
  const destination = watchPostDestination(video.postId);
  const imageUrl =
    typeof video.poster === "string" &&
    (video.poster.startsWith("https://") || video.poster.startsWith("http://"))
      ? video.poster
      : null;

  return {
    id: video.id,
    title,
    subtitle,
    metadata: formatViews(video.stats?.views ?? 0),
    imageUrl,
    destination,
    unavailable: destination == null,
    source: "watch",
  };
}

export function adaptWatchVideosToDiscoverCards(
  videos: WatchVideo[]
): DiscoverCardModel[] {
  return videos.map(adaptWatchVideoToDiscoverCard);
}
