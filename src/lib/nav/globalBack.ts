/**
 * Central Back policy for every user-facing mobile screen.
 * Arrow stays visible on root/tab surfaces but never exits the app.
 */

import {
  clearProfileBackContext,
  isPrimaryTabHref,
  peekProfileBackContext,
} from "@/src/lib/nav/profileBackContext";
import {
  followListOwnerFallbackHref,
  followListViaFallbackHref,
  isFollowListPath,
} from "@/src/lib/profile/followListNav";
import {
  isStackedProfilePath,
  parseProfileNavOrigin,
  profileOriginFallbackHref,
  type ProfileNavOrigin,
} from "@/src/lib/profile/profileNav";

export const PRIMARY_TAB_PATHS = [
  "/(tabs)/watch",
  "/(tabs)/discover",
  "/(tabs)/create",
  "/(tabs)/messages",
  "/(tabs)/profile",
  "/(tabs)/live",
] as const;

export const SECONDARY_PATHS = [
  "/settings",
  "/language",
  "/notifications",
  "/rewards",
  "/world",
  "/blocked-users",
  "/change-password",
  "/profile",
  "/profile/user",
  "/profile/member",
  "/profile/followers",
  "/profile/following",
  "/messages/[id]",
  "/sound/[id]",
  "/(auth)/signup",
  "/(auth)/forgot-password",
  "/(auth)/update-password",
] as const;

export const GLOBAL_HEADER_LAYOUT_DIRECTION = "ltr" as const;

export const GLOBAL_BACK_TITLE_OPTIONS = {
  headerBackTitle: "",
  headerBackTitleVisible: false,
  headerBackVisible: false,
  headerLeftContainerStyle: { direction: GLOBAL_HEADER_LAYOUT_DIRECTION },
  headerRightContainerStyle: { direction: GLOBAL_HEADER_LAYOUT_DIRECTION },
};

export const GLOBAL_STACK_HEADER_OPTIONS = {
  ...GLOBAL_BACK_TITLE_OPTIONS,
  headerBackButtonDisplayMode: "minimal" as const,
  // Native headerLeft/headerRight stay physically leading/trailing.
  // I18nManager RTL must not flip those slots independently of the hitbox.
  direction: GLOBAL_HEADER_LAYOUT_DIRECTION,
};

export type GlobalHeaderBackSlot = "left" | "right";

export function globalHeaderBackSlot(rtl: boolean): GlobalHeaderBackSlot {
  return rtl ? "right" : "left";
}

export type NavSurface = "root" | "auth-root" | "secondary" | "redirect";

export type GlobalBackDecision =
  | { action: "history-back" }
  | { action: "noop" }
  | { action: "replace"; href: string };

export type GlobalBackInput = {
  canGoBack: boolean;
  currentPath: string;
  segments?: readonly string[];
  previousRouteName?: string | null;
  profileHasOtherUser?: boolean;
  profileOrigin?: ProfileNavOrigin | string | null;
  profileVia?: string | string[] | null;
  profileListId?: string | string[] | null;
  profileListUsername?: string | string[] | null;
  followListOwnerId?: string | string[] | null;
  followListOwnerUsername?: string | string[] | null;
};

const TAB_LEAVES = new Set([
  "watch",
  "discover",
  "create",
  "messages",
  "profile",
  "live",
]);

const REDIRECT_LEAVES = new Set(["", "index", "invite/[code]"]);

export function normalizeNavPath(path: string): string {
  const noHash = path.trim().split("#")[0] ?? "";
  const noQuery = noHash.split("?")[0] ?? "";
  let p = noQuery.replace(/\/+$/, "") || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/\([^/]+\)/g, "");
  if (!p.startsWith("/")) p = `/${p}`;
  return p || "/";
}

export function isInternalRouteName(name: string | null | undefined): boolean {
  if (!name) return false;
  const t = name.trim();
  if (t === "(tabs)" || t === "(auth)") return true;
  if (/^\([^/)]+\)$/.test(t)) return true;
  if (t.includes("(tabs)") || t.includes("(auth)")) return true;
  return false;
}

export function sanitizeBackLabel(label: string | null | undefined): string {
  if (!label) return "";
  if (isInternalRouteName(label)) return "";
  return "";
}

export function previousRouteNameFromState(state: {
  index?: number;
  routes?: Array<{ name?: string }>;
} | null | undefined): string | null {
  if (!state?.routes || state.index == null || state.index < 1) return null;
  return state.routes[state.index - 1]?.name ?? null;
}

function leafFromSegments(segments: readonly string[]): string {
  return segments.filter((s) => !s.startsWith("(")).join("/");
}

function inferSegments(path: string): string[] {
  const raw = path.trim().split("?")[0] ?? "";
  return raw.split("/").filter(Boolean);
}

export function classifySurface(input: {
  path: string;
  segments?: readonly string[];
}): NavSurface {
  const segments = input.segments ?? inferSegments(input.path);
  const head = segments[0] ?? "";
  const leaf = leafFromSegments(segments);

  if (head === "index" || REDIRECT_LEAVES.has(leaf) || leaf.startsWith("invite/")) {
    return "redirect";
  }

  if (head === "(tabs)" || (TAB_LEAVES.has(leaf) && segments.includes("(tabs)"))) {
    return "root";
  }

  if (head === "(auth)") {
    return !segments[1] || segments[1] === "login" ? "auth-root" : "secondary";
  }

  if (TAB_LEAVES.has(leaf) && leaf !== "profile") {
    return "root";
  }

  if (leaf === "login") return "auth-root";
  if (leaf === "/" || leaf === "") return "redirect";

  return "secondary";
}

export function isRedirectOnlyRoute(name: string | null | undefined): boolean {
  if (name == null) return false;
  const t = name.trim();
  if (t === "(tabs)" || t === "(auth)" || /^\([^/)]+\)$/.test(t)) return false;
  if (t === "index" || t === "/" || t === "") return true;
  const n = normalizeNavPath(t);
  return n === "/" || n === "/index" || n.startsWith("/invite");
}

export function isValidHistoryPrevious(
  previousRouteName: string | null | undefined,
  currentPath: string
): boolean {
  if (previousRouteName == null || previousRouteName === "") return true;
  const previous = previousRouteName.trim();
  if (previous === "(tabs)" || previous === "(auth)") return true;
  if (isRedirectOnlyRoute(previous)) return false;
  const prev = normalizeNavPath(previous);
  const current = normalizeNavPath(currentPath);
  if (prev === current) return false;
  return true;
}

export function parentFallbackHref(path: string, segments?: readonly string[]): string | null {
  const leaf = leafFromSegments(segments ?? inferSegments(path));
  const n = normalizeNavPath(path);

  if (leaf.startsWith("messages/") || /^\/messages\/[^/]+$/.test(n)) {
    return "/(tabs)/messages";
  }
  if (
    n === "/settings" ||
    n === "/language" ||
    n === "/blocked-users" ||
    n === "/change-password" ||
    n === "/notifications" ||
    n === "/rewards"
  ) {
    return n === "/language" ? "/settings" : "/(tabs)/profile";
  }
  if (n === "/world") return "/(tabs)/discover";
  if (
    n === "/profile/followers" ||
    n === "/profile/following" ||
    leaf === "profile/followers" ||
    leaf === "profile/following"
  ) {
    return null;
  }
  if (
    n === "/profile" ||
    n === "/profile/user" ||
    n === "/profile/member" ||
    leaf === "profile" ||
    leaf === "profile/index" ||
    leaf === "profile/user" ||
    leaf === "profile/member"
  ) {
    return null;
  }
  if (
    n === "/signup" ||
    n === "/forgot-password" ||
    n === "/update-password" ||
    leaf === "signup" ||
    leaf === "forgot-password" ||
    leaf === "update-password"
  ) {
    return "/(auth)/login";
  }
  return "/(tabs)/watch";
}

function firstParam(
  value: string | string[] | null | undefined
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isTabContainerPrevious(
  previousRouteName: string | null | undefined
): boolean {
  if (previousRouteName == null || previousRouteName === "") return true;
  const previous = previousRouteName.trim();
  if (previous === "(tabs)") return true;
  if (previous.includes("(tabs)")) return true;
  const n = normalizeNavPath(previous);
  const leaf = n.replace(/^\//, "");
  return TAB_LEAVES.has(leaf);
}

export function isOriginAwareProfileStack(
  path: string,
  segments?: readonly string[]
): boolean {
  if (isStackedProfilePath(path, segments)) return true;
  if (isFollowListPath(path, segments)) return true;
  const n = normalizeNavPath(path);
  if (n !== "/profile") return false;
  return classifySurface({ path, segments }) === "secondary";
}

export function shouldTrustHistoryBack(input: GlobalBackInput): boolean {
  if (
    !input.canGoBack ||
    !isValidHistoryPrevious(input.previousRouteName, input.currentPath)
  ) {
    return false;
  }
  if (
    isOriginAwareProfileStack(input.currentPath, input.segments) &&
    isTabContainerPrevious(input.previousRouteName)
  ) {
    return false;
  }
  return true;
}

function withRememberedProfileBack(input: GlobalBackInput): GlobalBackInput {
  const remembered = peekProfileBackContext();
  return {
    ...input,
    profileOrigin:
      parseProfileNavOrigin(input.profileOrigin) ?? remembered.origin,
    profileVia: firstParam(input.profileVia) ?? remembered.via,
    profileListId: firstParam(input.profileListId) ?? remembered.listId,
    profileListUsername:
      firstParam(input.profileListUsername) ?? remembered.listUsername,
    followListOwnerId:
      firstParam(input.followListOwnerId) ?? remembered.ownerId,
    followListOwnerUsername:
      firstParam(input.followListOwnerUsername) ?? remembered.ownerUsername,
  };
}

export function resolveGlobalBack(input: GlobalBackInput): GlobalBackDecision {
  const resolved = withRememberedProfileBack(input);
  const surface = classifySurface({
    path: resolved.currentPath,
    segments: resolved.segments,
  });

  if (surface === "redirect") {
    return { action: "noop" };
  }

  if (surface === "root") {
    if (resolved.profileHasOtherUser) {
      const originHref = profileOriginFallbackHref(
        parseProfileNavOrigin(resolved.profileOrigin)
      );
      if (originHref && originHref !== "/(tabs)/profile") {
        return { action: "replace", href: originHref };
      }
      return { action: "replace", href: "/(tabs)/profile" };
    }
    return { action: "noop" };
  }

  if (surface === "auth-root") {
    return { action: "noop" };
  }

  const current = normalizeNavPath(resolved.currentPath);

  if (shouldTrustHistoryBack(resolved)) {
    return { action: "history-back" };
  }

  if (isStackedProfilePath(resolved.currentPath, resolved.segments)) {
    const viaHref = followListViaFallbackHref({
      via: resolved.profileVia,
      listOwnerId: resolved.profileListId,
      listOwnerUsername: resolved.profileListUsername,
      origin: resolved.profileOrigin,
    });
    if (viaHref && normalizeNavPath(viaHref) !== current) {
      return { action: "replace", href: viaHref };
    }
  }

  if (isFollowListPath(resolved.currentPath, resolved.segments)) {
    const ownerHref = followListOwnerFallbackHref({
      ownerId: resolved.followListOwnerId,
      ownerUsername: resolved.followListOwnerUsername,
      origin: resolved.profileOrigin,
    });
    if (ownerHref && normalizeNavPath(ownerHref) !== current) {
      return { action: "replace", href: ownerHref };
    }
  }

  const originHref = profileOriginFallbackHref(
    parseProfileNavOrigin(resolved.profileOrigin)
  );
  if (originHref && normalizeNavPath(originHref) !== current) {
    return { action: "replace", href: originHref };
  }

  const href = parentFallbackHref(resolved.currentPath, resolved.segments);
  if (href && normalizeNavPath(href) !== current) {
    return { action: "replace", href };
  }

  return { action: "noop" };
}

export function applyGlobalBackDecision(
  decision: GlobalBackDecision,
  nav: { back: () => void; replace: (href: string) => void }
): GlobalBackDecision["action"] {
  if (decision.action === "history-back") {
    nav.back();
    return "history-back";
  }
  if (decision.action === "replace") {
    if (isPrimaryTabHref(decision.href)) {
      clearProfileBackContext();
    }
    nav.replace(decision.href);
    return "replace";
  }
  return "noop";
}
