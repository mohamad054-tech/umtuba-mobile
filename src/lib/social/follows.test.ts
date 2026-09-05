import { describe, expect, it, vi } from "vitest";

import {
  followButtonLabel,
  getProfileFollowSnapshot,
  toggleProfileFollow,
} from "./follows";

function mockClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

describe("followButtonLabel", () => {
  it("uses Following, never Unfollow", () => {
    expect(followButtonLabel(false)).toBe("Follow");
    expect(followButtonLabel(true)).toBe("Following");
    expect(followButtonLabel(true)).not.toBe("Unfollow");
  });
});

describe("follow RPCs", () => {
  it("reads get_profile_follow_snapshot", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { following: true, followersCount: 4, followingCount: 2 },
      error: null,
    });
    const result = await getProfileFollowSnapshot(mockClient(rpc), "user-2");
    expect(rpc).toHaveBeenCalledWith("get_profile_follow_snapshot", {
      p_user_id: "user-2",
    });
    expect(result).toEqual({
      ok: true,
      following: true,
      followersCount: 4,
      followingCount: 2,
    });
  });

  it("toggles via toggle_profile_follow and maps auth errors", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "authentication required" },
    });
    const result = await toggleProfileFollow(mockClient(rpc), "user-2");
    expect(rpc).toHaveBeenCalledWith("toggle_profile_follow", {
      p_following_id: "user-2",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.requiresAuth).toBe(true);
      expect(result.message).toMatch(/sign in/i);
    }
  });

  it("rejects self-follow style invalid targets", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Invalid follow target" },
    });
    const result = await toggleProfileFollow(mockClient(rpc), "user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/can’t follow/i);
    }
  });
});
