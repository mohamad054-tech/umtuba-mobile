import type { ProfilePostItem } from "./listProfilePosts";
import type { ProfileVideoItem } from "./listProfileVideos";

export type ProfileTimelineItem =
  | {
      kind: "text" | "image";
      postId: number;
      content: string;
      imageUrl: string | null;
      createdAt: string;
    }
  | {
      kind: "video";
      postId: number;
      title: string;
      posterUrl: string | null;
      createdAt: string;
    };

function timeValue(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/** Mixed social wall: text, image, and video posts, newest first. */
export function buildProfileTimeline(
  posts: readonly ProfilePostItem[],
  videos: readonly ProfileVideoItem[]
): ProfileTimelineItem[] {
  const items: ProfileTimelineItem[] = [
    ...posts.map((post) => ({
      kind: post.postType,
      postId: post.postId,
      content: post.content,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
    })),
    ...videos.map((video) => ({
      kind: "video" as const,
      postId: video.postId,
      title: video.title,
      posterUrl: video.posterUrl,
      createdAt: video.createdAt,
    })),
  ];

  return items.sort((a, b) => {
    const byTime = timeValue(b.createdAt) - timeValue(a.createdAt);
    if (byTime !== 0) return byTime;
    return b.postId - a.postId;
  });
}
