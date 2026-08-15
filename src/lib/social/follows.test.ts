import { describe, expect, it } from "vitest";

import {
  applyCreatorFollowState,
  applyFollowToggleResult,
  canShowWatchFollowControl,
  isFollowTargetId,
  resolveWatchFollowAccessibilityHint,
  resolveWatchFollowLabel,
} from "@/src/lib/social/follows";

const VIEWER_ID = "11111111-1111-4111-8111-111111111111";
const CREATOR_ID = "22222222-2222-4222-8222-222222222222";

describe("native Watch follow control", () => {
  describe("canShowWatchFollowControl", () => {
    it("shows Follow for another creator", () => {
      expect(
        canShowWatchFollowControl({
          viewerId: VIEWER_ID,
          creatorId: CREATOR_ID,
        })
      ).toBe(true);
    });

    it("hides the control for self-follow", () => {
      expect(
        canShowWatchFollowControl({
          viewerId: VIEWER_ID,
          creatorId: VIEWER_ID,
        })
      ).toBe(false);
    });

    it("hides the control when the creator id is missing (demo)", () => {
      expect(
        canShowWatchFollowControl({ viewerId: VIEWER_ID, creatorId: null })
      ).toBe(false);
    });

    it("still shows Follow when signed out (action requires auth)", () => {
      expect(
        canShowWatchFollowControl({ viewerId: null, creatorId: CREATOR_ID })
      ).toBe(true);
    });
  });

  describe("resolveWatchFollowLabel", () => {
    it("uses Follow before success and Following after", () => {
      expect(resolveWatchFollowLabel({ following: false })).toBe("Follow");
      expect(resolveWatchFollowLabel({ following: true })).toBe("Following");
    });

    it("never uses Unfollow as the primary followed-state label", () => {
      expect(resolveWatchFollowLabel({ following: true })).not.toBe("Unfollow");
      expect(resolveWatchFollowLabel({ following: true, pending: true })).toBe(
        "Following"
      );
      expect(resolveWatchFollowLabel({ following: false, pending: true })).toBe(
        "Follow"
      );
    });

    it("exposes unfollow as the followed-state interaction, not the label", () => {
      expect(resolveWatchFollowAccessibilityHint(true)).toBe(
        "Unfollow this creator"
      );
      expect(resolveWatchFollowAccessibilityHint(false)).toBe(
        "Follow this creator"
      );
    });
  });

  describe("applyFollowToggleResult", () => {
    it("does not flip to Following when the server action fails", () => {
      const next = applyFollowToggleResult({
        previousFollowing: false,
        result: { ok: false, message: "Unable to update follow." },
      });
      expect(next).toEqual({ following: false, applied: false });
    });

    it("reconciles to the server following flag on success", () => {
      expect(
        applyFollowToggleResult({
          previousFollowing: false,
          result: {
            ok: true,
            following: true,
            followersCount: 2,
            followingCount: 1,
          },
        })
      ).toEqual({ following: true, applied: true });
    });

    it("unfollows only after a successful toggle", () => {
      const next = applyFollowToggleResult({
        previousFollowing: true,
        result: {
          ok: true,
          following: false,
          followersCount: 1,
          followingCount: 1,
        },
      });
      expect(next).toEqual({ following: false, applied: true });
    });
  });

  describe("applyCreatorFollowState", () => {
    it("updates every clip for the same creator target", () => {
      const videos = [
        { id: "a", author: { id: CREATOR_ID, isFollowing: false } },
        { id: "b", author: { id: VIEWER_ID, isFollowing: false } },
        { id: "c", author: { id: CREATOR_ID, isFollowing: false } },
      ];
      const next = applyCreatorFollowState(videos, CREATOR_ID, true);
      expect(next[0].author.isFollowing).toBe(true);
      expect(next[1].author.isFollowing).toBe(false);
      expect(next[2].author.isFollowing).toBe(true);
    });
  });

  it("accepts only UUID follow targets", () => {
    expect(isFollowTargetId(CREATOR_ID)).toBe(true);
    expect(isFollowTargetId("eman")).toBe(false);
    expect(isFollowTargetId("")).toBe(false);
  });
});
