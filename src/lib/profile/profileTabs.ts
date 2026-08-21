/**
 * Shared mobile Profile tabs. Data-backed only — no empty creator-hub stubs
 * (Articles / Courses / Products / Photos / Live).
 */

export type MobileProfileTabId = "all" | "posts" | "videos" | "about";

export const MOBILE_PROFILE_TAB_ORDER: readonly MobileProfileTabId[] = [
  "all",
  "posts",
  "videos",
  "about",
] as const;

export type MobileProfileTabVisibilityInput = {
  isOwner: boolean;
  postCount: number;
  videoCount: number;
};

/**
 * Always All + About.
 * Posts / Videos when the owner is viewing or the count is > 0.
 */
export function getVisibleMobileProfileTabs(
  input: MobileProfileTabVisibilityInput
): MobileProfileTabId[] {
  return MOBILE_PROFILE_TAB_ORDER.filter((id) => {
    switch (id) {
      case "all":
      case "about":
        return true;
      case "posts":
        return input.isOwner || input.postCount > 0;
      case "videos":
        return input.isOwner || input.videoCount > 0;
      default:
        return false;
    }
  });
}

export function parseMobileProfileTab(
  raw: string | null | undefined
): MobileProfileTabId {
  if (raw === "posts" || raw === "videos" || raw === "about" || raw === "all") {
    return raw;
  }
  return "all";
}

export function resolveActiveMobileProfileTab(
  raw: string | null | undefined,
  visible: readonly MobileProfileTabId[]
): MobileProfileTabId {
  const parsed = parseMobileProfileTab(raw);
  return visible.includes(parsed) ? parsed : "all";
}
