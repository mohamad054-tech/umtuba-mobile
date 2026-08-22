import { afterEach, describe, expect, it } from "vitest";

import type { VideoPostRow } from "./watchFeed";
import { fetchWatchFeedPage, refreshPlaybackUrl } from "./watchFeed";
import { watchSignedUrlCache } from "./signedUrlCache";
import { prepareWatchPlaybackUrls } from "./watchPlaybackPrep";

function row(id: number, path = `owner/${id}.mp4`): VideoPostRow {
  return {
    id,
    user_id: "11111111-1111-4111-8111-111111111111",
    content: `clip ${id}`,
    post_type: "video",
    author_name: "Ada",
    author_username: "ada",
    author_avatar: "A",
    image_url: null,
    video_url: null,
    video_path: path,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    views: 0,
    created_at: `2026-01-01T00:00:${String(id).padStart(2, "0")}Z`,
  };
}

function createFeedClient(options: {
  rows: VideoPostRow[];
  sign?: (path: string) => Promise<{
    data: { signedUrl?: string } | null;
    error: { message: string; status?: number } | null;
  }>;
}) {
  const signCalls: string[] = [];
  const inflight: string[] = [];
  let maxInflight = 0;
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    not() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    or() {
      return this;
    },
    maybeSingle: async () => ({
      data:
        options.rows[0] ?? {
          id: 1,
          video_path: "owner/1.mp4",
          video_url: null,
          post_type: "video",
        },
      error: null,
    }),
    then(resolve: (value: { data: VideoPostRow[]; error: null }) => void) {
      resolve({ data: options.rows, error: null });
    },
  };
  const client = {
    signCalls,
    get maxInflight() {
      return maxInflight;
    },
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
    from(table: string) {
      if (table === "posts") return query;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({
          data: options.rows[0] ?? { id: 1, video_path: "owner/1.mp4", video_url: null, post_type: "video" },
          error: null,
        }),
        in() {
          return Promise.resolve({ data: [], error: null });
        },
      };
    },
    storage: {
      from() {
        return {
          createSignedUrl: async (path: string) => {
            signCalls.push(path);
            inflight.push(path);
            maxInflight = Math.max(maxInflight, inflight.length);
            const result = options.sign
              ? await options.sign(path)
              : {
                  data: { signedUrl: `https://signed.example/${path}` },
                  error: null,
                };
            inflight.pop();
            return result;
          },
        };
      },
    },
  };
  return client;
}

describe("fetchWatchFeedPage signed-URL fanout", () => {
  afterEach(() => {
    watchSignedUrlCache.clear();
  });

  it("returns the page without signing every row first", async () => {
    const client = createFeedClient({
      rows: Array.from({ length: 12 }, (_, i) => row(i + 1)),
    });
    const page = await fetchWatchFeedPage(client as never, { limit: 12 });
    expect(page.videos).toHaveLength(12);
    expect(page.videos.every((video) => video.videoPath)).toBe(true);
    expect(page.videos.filter((video) => video.src === "")).toHaveLength(12);
    expect(client.signCalls).toEqual([]);
  });

  it("resolves the active URL first and does not wait for the rest of the page", async () => {
    const started: string[] = [];
    const client = createFeedClient({
      rows: Array.from({ length: 12 }, (_, i) => row(i + 1)),
      sign: async (path) => {
        started.push(path);
        if (path === "owner/1.mp4") {
          await new Promise((resolve) => setTimeout(resolve, 15));
        } else {
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        return {
          data: { signedUrl: `https://signed.example/${path}` },
          error: null,
        };
      },
    });
    const page = await fetchWatchFeedPage(client as never, { limit: 12 });
    const applied: string[] = [];
    const prep = prepareWatchPlaybackUrls(
      client as never,
      page.videos,
      0,
      {
        onResolved: (id, src) => {
          applied.push(`${id}:${src}`);
        },
      }
    );
    const result = await prep;
    expect(result.activeSrc).toBe("https://signed.example/owner/1.mp4");
    expect(started[0]).toBe("owner/1.mp4");
    expect(applied[0]).toContain("post-1");
    expect(started.length).toBeLessThan(12);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(client.signCalls[0]).toBe("owner/1.mp4");
    expect(new Set(client.signCalls).size).toBeLessThanOrEqual(11);
  });

  it("recovers from a 403 by invalidating and re-signing only that path", async () => {
    let attempt = 0;
    const client = createFeedClient({
      rows: [row(9, "/owner/9.mp4")],
      sign: async (path) => {
        attempt += 1;
        if (attempt === 1) {
          return {
            data: null,
            error: { message: "Forbidden", status: 403 },
          };
        }
        return {
          data: { signedUrl: `https://signed.example/${path}?fresh=1` },
          error: null,
        };
      },
    });
    const page = await fetchWatchFeedPage(client as never, { limit: 1 });
    expect(page.videos[0]?.videoPath).toBe("owner/9.mp4");
    watchSignedUrlCache.set("owner/9.mp4", "https://expired.example/9");
    const refreshed = await refreshPlaybackUrl(client as never, 9);
    expect(refreshed).toEqual({
      ok: true,
      src: "https://signed.example/owner/9.mp4?fresh=1",
    });
    expect(client.signCalls).toEqual(["owner/9.mp4", "owner/9.mp4"]);
  });

  it("dedupes concurrent signs for the same media path", async () => {
    const client = createFeedClient({
      rows: [row(1), { ...row(2), video_path: "owner/1.mp4" }],
    });
    const page = await fetchWatchFeedPage(client as never, { limit: 2 });
    await Promise.all([
      prepareWatchPlaybackUrls(client as never, page.videos, 0),
      prepareWatchPlaybackUrls(client as never, page.videos, 1),
    ]);
    const unique = client.signCalls.filter((path) => path === "owner/1.mp4");
    expect(unique.length).toBeLessThanOrEqual(2);
  });
});
