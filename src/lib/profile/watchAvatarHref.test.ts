import { describe, expect, it } from "vitest";

import { mapRowToWatchVideo, type VideoPostRow } from "@/src/lib/feed/watchFeed";
import {
  planOtherProfileLookup,
  resolveProfileTarget,
} from "@/src/lib/profile/resolveTarget";
import { buildWatchCreatorProfileHref } from "@/src/lib/profile/watchAvatarHref";

const CREATOR_ID = "11111111-1111-4111-8111-111111111111";
const VIEWER_ID = "22222222-2222-4222-8222-222222222222";

const baseRow: VideoPostRow = {
  id: 99,
  user_id: CREATOR_ID,
  content: "Hello from UMTUBA",
  post_type: "video",
  author_name: "Ada",
  author_username: "ada",
  author_avatar: "A",
  image_url: null,
  video_url: null,
  video_path: "user/clip.mp4",
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  views: 0,
  created_at: "2026-01-01T00:00:00Z",
};

function hrefParams(href: string): URLSearchParams {
  const q = href.split("?")[1] ?? "";
  return new URLSearchParams(q);
}

describe("Watch creator avatar → other-user Profile", () => {
  it("passes profiles.id plus username so ?u= mismatch cannot 404", () => {
    const video = mapRowToWatchVideo({
      row: baseRow,
      playbackUrl: "https://cdn.example/signed.mp4",
      likedByMe: false,
      savedByMe: false,
    });

    const href = buildWatchCreatorProfileHref(video.author);
    expect(href).toBe(`/profile/user?u=ada&id=${CREATOR_ID}&from=watch`);

    const params = hrefParams(href!);
    const target = resolveProfileTarget({
      queryUsername: params.get("u"),
      queryUserId: params.get("id"),
      signedInUsername: "sam",
      signedInUserId: VIEWER_ID,
    });

    expect(target).toEqual({
      kind: "other",
      username: "ada",
      userId: CREATOR_ID,
    });
    if (target.kind !== "other") return;
    expect(planOtherProfileLookup(target)).toEqual({
      primary: { field: "id", value: CREATOR_ID },
      fallback: { field: "username", value: "ada" },
    });
  });

  it("still opens the creator when posts.author_username is the @user fallback", () => {
    const video = mapRowToWatchVideo({
      row: { ...baseRow, author_username: "" },
      playbackUrl: "https://cdn.example/signed.mp4",
      likedByMe: false,
      savedByMe: false,
    });

    expect(video.author.username).toBe("@user");
    const href = buildWatchCreatorProfileHref(video.author);
    expect(href).toBe(`/profile/user?u=user&id=${CREATOR_ID}&from=watch`);

    const params = hrefParams(href!);
    const target = resolveProfileTarget({
      queryUsername: params.get("u"),
      queryUserId: params.get("id"),
      signedInUsername: "sam",
      signedInUserId: VIEWER_ID,
    });

    expect(target.kind).toBe("other");
    if (target.kind !== "other") return;
    expect(target.userId).toBe(CREATOR_ID);
    expect(planOtherProfileLookup(target).primary).toEqual({
      field: "id",
      value: CREATOR_ID,
    });
  });

  it("opens own Profile when the Watch author is the signed-in user", () => {
    const href = buildWatchCreatorProfileHref({
      id: VIEWER_ID,
      username: "@sam",
    });
    expect(href).toBe(`/profile/user?u=sam&id=${VIEWER_ID}&from=watch`);

    expect(
      resolveProfileTarget({
        queryUsername: "sam",
        queryUserId: VIEWER_ID,
        signedInUsername: "sam",
        signedInUserId: VIEWER_ID,
      })
    ).toEqual({ kind: "own" });
  });

  it("does not navigate without a username or profile id", () => {
    expect(buildWatchCreatorProfileHref({ id: null, username: "" })).toBeNull();
    expect(
      buildWatchCreatorProfileHref({ id: "not-a-uuid", username: "@" })
    ).toBeNull();
  });
});
