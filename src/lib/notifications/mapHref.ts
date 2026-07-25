import {
  deepLinkToHref,
  parseDeepLink,
} from "@/src/lib/linking/deepLinks";

/**
 * Map a notification href (often a web path) to a mobile Expo Router href.
 * Returns null when the destination is unknown or unsafe — caller must not navigate.
 */
export function mapNotificationHrefToMobile(
  href: string | null | undefined
): string | null {
  if (!href || typeof href !== "string") return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.includes("..")) return null;

  // Already an app-relative path we understand via deep-link parser.
  let candidate = trimmed;

  if (candidate.startsWith("/discover")) {
    const qIndex = candidate.indexOf("?");
    const query = qIndex >= 0 ? candidate.slice(qIndex + 1) : "";
    const params = new URLSearchParams(query);
    const post = params.get("post") || params.get("postId");
    if (post && /^\d+$/.test(post)) {
      return `/(tabs)/watch?post=${post}`;
    }
    return "/(tabs)/discover";
  }

  if (candidate.startsWith("/watch")) {
    candidate = candidate.replace(/^\/watch/, "/watch");
  }

  // Normalize absolute UMTUBA URLs to path-only for parseDeepLink.
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.toLowerCase();
      if (host !== "umtuba.com" && host !== "www.umtuba.com") {
        return null;
      }
      candidate = `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  if (candidate.startsWith("umtuba://")) {
    // keep as-is for parseDeepLink
  } else if (candidate.startsWith("/")) {
    candidate = `umtuba://${candidate.replace(/^\/+/, "")}`;
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `umtuba://${candidate}`;
  } else {
    return null;
  }

  const parsed = parseDeepLink(candidate);
  if (parsed.target.type === "unknown") {
    return null;
  }
  return deepLinkToHref(parsed.target);
}

export function canOpenNotificationDestination(
  href: string | null | undefined
): boolean {
  return mapNotificationHrefToMobile(href) != null;
}
