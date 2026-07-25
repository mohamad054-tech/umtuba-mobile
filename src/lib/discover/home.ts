import { getErrorMessage } from "@/src/contracts/validation";
import type { WatchVideo } from "@/src/contracts/watch";
import { adaptWatchVideosToDiscoverCards } from "@/src/lib/discover/adaptWatch";
import { getDiscoverCategories } from "@/src/lib/discover/categories";
import type {
  DiscoverCardModel,
  DiscoverHomeModel,
  DiscoverLoadResult,
  DiscoverSectionModel,
} from "@/src/lib/discover/types";
import { fetchWatchFeedPage } from "@/src/lib/feed/watchFeed";
import type { SupabaseClient } from "@supabase/supabase-js";

function section(
  id: string,
  title: string,
  items: DiscoverCardModel[],
  emptyMessage: string
): DiscoverSectionModel {
  if (items.length === 0) {
    return {
      id,
      title,
      status: "empty",
      message: emptyMessage,
      items: [],
    };
  }
  return {
    id,
    title,
    status: "ready",
    message: null,
    items,
  };
}

function unavailableSection(
  id: string,
  title: string,
  message: string
): DiscoverSectionModel {
  return {
    id,
    title,
    status: "unavailable",
    message,
    items: [],
  };
}

/**
 * Build Discover home sections from Watch feed videos only.
 * - Latest: feed order (created_at desc from source)
 * - Trending: same items ranked by views when views exist
 * - Recommended: unavailable (no personalization source yet)
 */
export function buildDiscoverHomeFromWatchVideos(
  videos: WatchVideo[]
): DiscoverHomeModel {
  const cards = adaptWatchVideosToDiscoverCards(videos);

  const latest = section(
    "latest",
    "Latest",
    cards.slice(0, 12),
    "No latest videos yet."
  );

  const trendingVideos = [...videos]
    .filter((v) => (v.stats?.views ?? 0) > 0)
    .sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0));
  const trendingCards = adaptWatchVideosToDiscoverCards(trendingVideos).slice(
    0,
    12
  );

  const trending = section(
    "trending",
    "Trending",
    trendingCards,
    "No trending videos yet."
  );

  const recommended = unavailableSection(
    "recommended",
    "Recommended",
    "Personalized recommendations are not available yet."
  );

  const placeholders: DiscoverSectionModel[] = [
    unavailableSection(
      "world",
      "World",
      "World experience is available. The owned map renderer is being prepared."
    ),
    unavailableSection(
      "people",
      "People",
      "People discovery is not available yet."
    ),
    unavailableSection(
      "hashtags",
      "Hashtags",
      "Hashtag discovery is not available yet."
    ),
  ];

  return {
    categories: getDiscoverCategories(),
    trending,
    latest,
    recommended,
    placeholders,
  };
}

/**
 * Load Discover home via existing Watch feed — no new RPC/table.
 */
export async function loadDiscoverHome(
  client: SupabaseClient,
  options?: { limit?: number }
): Promise<DiscoverLoadResult> {
  try {
    const page = await fetchWatchFeedPage(client, {
      limit: options?.limit ?? 16,
    });
    const home = buildDiscoverHomeFromWatchVideos(page.videos);
    const cards = adaptWatchVideosToDiscoverCards(page.videos);
    return { ok: true, home, cards };
  } catch (err) {
    const message = getErrorMessage(err, "Unable to load Discover.");
    const unavailable =
      /could not find the (table|function)|schema cache|does not exist|PGRST202|PGRST205|404/i.test(
        message
      );
    return { ok: false, message, unavailable };
  }
}
