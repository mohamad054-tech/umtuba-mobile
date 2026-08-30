import { describe, expect, it, vi } from "vitest";

import {
  ensureProfileFollow,
  followButtonLabel,
  getProfileFollowSnapshot,
  resetEnsureProfileFollowInflightForTests,
  toggleProfileFollow,
} from "./follows";

function mockClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as never;
}

describe("ensureProfileFollow", () => {
  it("no-ops when already following and never toggles", async () => {
    resetEnsureProfileFollowInflightForTests();
    const rpc = vi.fn();
    const result = await ensureProfileFollow(mockClient(rpc), "user-2", {
      following: true,
      followersCount: 4,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      following: true,
      followersCount: 4,
      followingCount: 0,
      noop: true,
    });
  });

  it("follows once and refuses an unexpected unfollow result", async () => {
    resetEnsureProfileFollowInflightForTests();
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "get_profile_follow_snapshot") {
        return Promise.resolve({
          data: { following: false, followersCount: 3, followingCount: 1 },
          error: null,
        });
      }
      return Promise.resolve({
        data: { following: false, followersCount: 3, followingCount: 1 },
        error: null,
      });
    });
    const result = await ensureProfileFollow(mockClient(rpc), "user-2");
    expect(result.ok).toBe(false);
    expect(rpc).toHaveBeenCalledWith("get_profile_follow_snapshot", {
      p_user_id: "user-2",
    });
    expect(rpc).toHaveBeenCalledWith("toggle_profile_follow", {
      p_following_id: "user-2",
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("no-ops when the server snapshot is already following", async () => {
    resetEnsureProfileFollowInflightForTests();
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "get_profile_follow_snapshot") {
        return Promise.resolve({
          data: { following: true, followersCount: 4, followingCount: 1 },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const result = await ensureProfileFollow(mockClient(rpc), "user-2");
    expect(result).toEqual({
      ok: true,
      following: true,
      followersCount: 4,
      followingCount: 1,
      noop: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith("toggle_profile_follow", {
      p_following_id: "user-2",
    });
  });

  it("applies a successful follow", async () => {
    resetEnsureProfileFollowInflightForTests();
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "get_profile_follow_snapshot") {
        return Promise.resolve({
          data: { following: false, followersCount: 4, followingCount: 0 },
          error: null,
        });
      }
      return Promise.resolve({
        data: { following: true, followersCount: 5, followingCount: 1 },
        error: null,
      });
    });
    const result = await ensureProfileFollow(mockClient(rpc), "user-2");
    expect(result).toEqual({
      ok: true,
      following: true,
      followersCount: 5,
      followingCount: 1,
      noop: false,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

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
