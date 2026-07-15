export type WatchVideoSource = "supabase" | "demo";

export type WatchVideoAuthor = {
  id: string | null;
  name: string;
  username: string;
  avatar: string;
};

export type WatchVideoStats = {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  views: number;
};

export type WatchVideo = {
  id: string;
  /** Numeric post id when source is supabase; null for demo. */
  postId: number | null;
  src: string;
  poster?: string;
  title: string;
  caption: string;
  location: { city: string; country: string };
  music: string;
  aiSummary: string;
  translation: string;
  author: WatchVideoAuthor;
  stats: WatchVideoStats;
  likedByMe: boolean;
  savedByMe: boolean;
  source: WatchVideoSource;
};

export type WatchFeedCursor = {
  createdAt: string;
  id: number;
};

export type WatchFeedPage = {
  videos: WatchVideo[];
  nextCursor: WatchFeedCursor | null;
  usedDemoFallback: boolean;
};

export const WATCH_FEED_PAGE_SIZE = 12;
