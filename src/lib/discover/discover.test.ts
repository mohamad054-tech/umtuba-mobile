import { describe, expect, it } from "vitest";

import type { WatchVideo } from "@/src/contracts/watch";
import {
  adaptWatchVideoToDiscoverCard,
  buildDiscoverHomeFromWatchVideos,
  canOpenDiscoverDestination,
  filterDiscoverCards,
  getDiscoverCategories,
  isSupportedDiscoverCategory,
  mapDiscoverCategoryHref,
  mapDiscoverDestination,
  resolveDiscoverSearchPhase,
  shouldShowDiscoverWorldEntry,
  watchPostDestination,
} from "@/src/lib/discover";
import { discoverWorldEntryHref } from "@/src/lib/world/experience";

function video(partial: Partial<WatchVideo> & Pick<WatchVideo, "id">): WatchVideo {
  return {
    postId: 1,
    src: "https://cdn.example/a.mp4",
    title: "Clip",
    caption: "Clip caption",
    location: { city: "", country: "" },
    music: "",
    aiSummary: "",
    translation: "",
    author: {
      id: "u1",
      name: "Ada",
      username: "@ada",
      avatar: "A",
    },
    stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
    likedByMe: false,
    savedByMe: false,
    source: "supabase",
    ...partial,
  };
}

describe("discover categories", () => {
  it("displays only supported categories by default", () => {
    const visible = getDiscoverCategories();
    expect(visible.map((c) => c.id)).toEqual(["watch", "live"]);
    expect(visible.every((c) => c.supported)).toBe(true);
  });

  it("keeps unsupported categories in expandable catalog", () => {
    const all = getDiscoverCategories({ includeUnsupported: true });
    expect(all.map((c) => c.id)).toContain("learning");
    expect(all.map((c) => c.id)).toContain("games");
    expect(isSupportedDiscoverCategory("learning")).toBe(false);
    expect(mapDiscoverCategoryHref("learning")).toBeNull();
    expect(mapDiscoverCategoryHref("watch")).toBe("/(tabs)/watch");
  });
});

describe("discover destination safety", () => {
  it("maps trusted watch destinations only", () => {
    expect(mapDiscoverDestination("/(tabs)/watch?post=42")).toEqual({
      pathname: "/(tabs)/watch",
      params: { post: "42" },
    });
    expect(mapDiscoverDestination("/(tabs)/live")).toBe("/(tabs)/live");
    expect(canOpenDiscoverDestination("https://evil.example")).toBe(false);
    expect(mapDiscoverDestination("/admin")).toBeNull();
    expect(watchPostDestination(0)).toBeNull();
    expect(watchPostDestination(9)).toEqual({
      pathname: "/(tabs)/watch",
      params: { post: "9" },
    });
  });
});

describe("adaptWatchVideoToDiscoverCard", () => {
  it("adapts watch video into a card with destination", () => {
    const card = adaptWatchVideoToDiscoverCard(
      video({
        id: "post-7",
        postId: 7,
        title: "Sunset",
        poster: "https://cdn.example/p.jpg",
        stats: { likes: 1, comments: 0, shares: 0, saves: 0, views: 1200 },
      })
    );
    expect(card.title).toBe("Sunset");
    expect(card.subtitle).toBe("@ada");
    expect(card.metadata).toBe("1.2K views");
    expect(card.imageUrl).toBe("https://cdn.example/p.jpg");
    expect(card.unavailable).toBe(false);
    expect(card.destination).toEqual({
      pathname: "/(tabs)/watch",
      params: { post: "7" },
    });
  });

  it("marks card unavailable when post id is missing", () => {
    const card = adaptWatchVideoToDiscoverCard(
      video({ id: "demo-1", postId: null })
    );
    expect(card.unavailable).toBe(true);
    expect(card.destination).toBeNull();
  });
});

describe("buildDiscoverHomeFromWatchVideos", () => {
  it("builds empty trending/latest without inventing items", () => {
    const home = buildDiscoverHomeFromWatchVideos([]);
    expect(home.latest.status).toBe("empty");
    expect(home.trending.status).toBe("empty");
    expect(home.recommended.status).toBe("unavailable");
    expect(home.placeholders.every((p) => p.status === "unavailable")).toBe(
      true
    );
    expect(home.latest.items).toEqual([]);
  });

  it("builds latest and trending from watch videos", () => {
    const home = buildDiscoverHomeFromWatchVideos([
      video({
        id: "post-1",
        postId: 1,
        title: "A",
        stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 10 },
      }),
      video({
        id: "post-2",
        postId: 2,
        title: "B",
        stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 50 },
      }),
    ]);
    expect(home.latest.status).toBe("ready");
    expect(home.latest.items).toHaveLength(2);
    expect(home.trending.status).toBe("ready");
    expect(home.trending.items[0]?.id).toBe("post-2");
  });
});

describe("discover World entry independence", () => {
  it("shows World entry regardless of home null/loaded/search", () => {
    expect(shouldShowDiscoverWorldEntry({ home: null })).toBe(true);
    expect(
      shouldShowDiscoverWorldEntry({
        home: buildDiscoverHomeFromWatchVideos([]),
      })
    ).toBe(true);
    expect(
      shouldShowDiscoverWorldEntry({
        home: null,
        searchPhase: "empty",
      })
    ).toBe(true);
    expect(
      shouldShowDiscoverWorldEntry({
        home: null,
        searchPhase: "results",
      })
    ).toBe(true);
    expect(discoverWorldEntryHref()).toBe("/world");
  });
});

describe("discover search", () => {
  it("returns no results for empty query and filters without fakes", () => {
    const cards = [
      adaptWatchVideoToDiscoverCard(
        video({ id: "post-1", postId: 1, title: "Ocean wave" })
      ),
      adaptWatchVideoToDiscoverCard(
        video({ id: "post-2", postId: 2, title: "Desert road" })
      ),
    ];
    expect(filterDiscoverCards(cards, "")).toEqual([]);
    expect(filterDiscoverCards(cards, "ocean")).toHaveLength(1);
    expect(filterDiscoverCards(cards, "zzzz")).toHaveLength(0);
    expect(resolveDiscoverSearchPhase({
      query: "",
      loading: false,
      error: null,
      resultCount: 0,
    })).toBe("idle");
    expect(resolveDiscoverSearchPhase({
      query: "ocean",
      loading: false,
      error: null,
      resultCount: 0,
    })).toBe("empty");
    expect(resolveDiscoverSearchPhase({
      query: "ocean",
      loading: false,
      error: null,
      resultCount: 1,
    })).toBe("results");
  });
});
