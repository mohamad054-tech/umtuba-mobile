import { describe, expect, it } from "vitest";

import {
  buildWatchProfileHref,
  firstRouteParam,
  resolveProfileScreenIdentity,
  resolveWatchProfileNavParams,
  resolveWatchSafetyTarget,
} from "@/src/lib/profile/profileTarget";

const VIEWER_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "22222222-2222-2222-2222-222222222222";

describe("Watch → content owner profile navigation", () => {
  describe("firstRouteParam", () => {
    it("reads umtuba://profile?u=eman as the requested username", () => {
      expect(firstRouteParam("eman")).toBe("eman");
      expect(firstRouteParam(["eman"])).toBe("eman");
    });

    it("ignores empty / missing params", () => {
      expect(firstRouteParam(undefined)).toBeNull();
      expect(firstRouteParam("")).toBeNull();
      expect(firstRouteParam(["", "x"])).toBeNull();
    });
  });

  describe("resolveWatchProfileNavParams", () => {
    it("uses the owner id and username, not the viewer", () => {
      const params = resolveWatchProfileNavParams({
        id: OWNER_ID,
        username: "@creator",
      });
      expect(params.uid).toBe(OWNER_ID);
      expect(params.u).toBe("creator");
    });

    it("omits missing identity fields (demo content)", () => {
      expect(resolveWatchProfileNavParams({ id: null, username: "" })).toEqual(
        {}
      );
    });
  });

  describe("buildWatchProfileHref", () => {
    it("targets the content owner id — bug regression", () => {
      const href = buildWatchProfileHref({ id: OWNER_ID, username: "@creator" });
      expect(href).toBe(`/profile?uid=${OWNER_ID}&u=creator`);
      // The signed-in viewer id must never appear in the target route.
      expect(href).not.toContain(VIEWER_ID);
    });

    it("falls back to username-only when the owner id is unknown", () => {
      expect(buildWatchProfileHref({ id: null, username: "creator" })).toBe(
        "/profile?u=creator"
      );
    });

    it("returns null when the owner has no usable identity", () => {
      expect(buildWatchProfileHref({ id: null, username: "" })).toBeNull();
    });
  });

  describe("resolveProfileScreenIdentity", () => {
    it("other-user content opens the OWNER's public profile (not own)", () => {
      const identity = resolveProfileScreenIdentity({
        paramUserId: OWNER_ID,
        paramUsername: "creator",
        viewerId: VIEWER_ID,
        viewerUsername: "me",
      });
      expect(identity).toEqual({
        mode: "other",
        userId: OWNER_ID,
        username: "creator",
      });
    });

    it("username-only deep link umtuba://profile?u=eman opens eman, not the viewer", () => {
      const identity = resolveProfileScreenIdentity({
        paramUserId: firstRouteParam(undefined),
        paramUsername: firstRouteParam("eman"),
        viewerId: VIEWER_ID,
        viewerUsername: "mohamad",
      });
      expect(identity).toEqual({
        mode: "other",
        userId: null,
        username: "eman",
      });
    });

    it("owner id is authoritative even if a username collides with the viewer", () => {
      const identity = resolveProfileScreenIdentity({
        paramUserId: OWNER_ID,
        paramUsername: "me",
        viewerId: VIEWER_ID,
        viewerUsername: "me",
      });
      expect(identity.mode).toBe("other");
    });

    it("own content opens the viewer's own profile (by id)", () => {
      const identity = resolveProfileScreenIdentity({
        paramUserId: VIEWER_ID,
        paramUsername: "me",
        viewerId: VIEWER_ID,
        viewerUsername: "me",
      });
      expect(identity).toEqual({ mode: "self" });
    });

    it("own content opens own profile when matched by username only", () => {
      const identity = resolveProfileScreenIdentity({
        paramUserId: null,
        paramUsername: "@me",
        viewerId: VIEWER_ID,
        viewerUsername: "me",
      });
      expect(identity).toEqual({ mode: "self" });
    });

    it("no route params → own profile", () => {
      expect(
        resolveProfileScreenIdentity({
          viewerId: VIEWER_ID,
          viewerUsername: "me",
        })
      ).toEqual({ mode: "self" });
    });
  });

  describe("resolveWatchSafetyTarget", () => {
    it("Report/Block targets the selected content owner, not the viewer", () => {
      const target = resolveWatchSafetyTarget({
        postId: 42,
        author: { id: OWNER_ID, username: "@creator" },
      });
      expect(target).toEqual({
        postId: 42,
        userId: OWNER_ID,
        displayName: "@creator",
      });
      expect(target.userId).not.toBe(VIEWER_ID);
    });
  });
});
