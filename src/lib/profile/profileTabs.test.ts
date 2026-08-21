import { describe, expect, it } from "vitest";

import { buildProfileShareUrl } from "@/src/lib/profile/profileShareUrl";
import {
  getVisibleMobileProfileTabs,
  parseMobileProfileTab,
  resolveActiveMobileProfileTab,
} from "@/src/lib/profile/profileTabs";

describe("mobile profile tabs", () => {
  it("always keeps All and About", () => {
    expect(
      getVisibleMobileProfileTabs({
        isOwner: false,
        postCount: 0,
        videoCount: 0,
      })
    ).toEqual(["all", "about"]);
  });

  it("shows Posts for the owner even when empty", () => {
    expect(
      getVisibleMobileProfileTabs({
        isOwner: true,
        postCount: 0,
        videoCount: 0,
      })
    ).toEqual(["all", "posts", "videos", "about"]);
  });

  it("shows Posts for other users only when posts exist", () => {
    expect(
      getVisibleMobileProfileTabs({
        isOwner: false,
        postCount: 2,
        videoCount: 0,
      })
    ).toEqual(["all", "posts", "about"]);
  });

  it("does not invent Articles / Courses / Products / Live tabs", () => {
    const tabs = getVisibleMobileProfileTabs({
      isOwner: true,
      postCount: 1,
      videoCount: 1,
    });
    expect(tabs).not.toContain("articles");
    expect(tabs).not.toContain("courses");
    expect(tabs).not.toContain("products");
    expect(tabs).not.toContain("photos");
    expect(tabs).not.toContain("live");
  });

  it("falls unknown tab query back to all", () => {
    expect(parseMobileProfileTab("courses")).toBe("all");
    expect(resolveActiveMobileProfileTab("videos", ["all", "about"])).toBe(
      "all"
    );
    expect(resolveActiveMobileProfileTab("posts", ["all", "posts", "about"])).toBe(
      "posts"
    );
  });
});

describe("profile share url", () => {
  it("builds the public Creator Space URL and refuses empty handles", () => {
    expect(buildProfileShareUrl("Lina.Creates")).toBe(
      "https://umtuba.com/profile/lina.creates"
    );
    expect(buildProfileShareUrl("")).toBeNull();
    expect(buildProfileShareUrl(null)).toBeNull();
  });
});
