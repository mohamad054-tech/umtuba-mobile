/**
 * Safe in-app destinations for World navigation metadata.
 * Fail-closed: no external map providers, no invented deep hosts.
 */

export function mapWorldDestination(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("..")) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      if (host !== "umtuba.com" && host !== "www.umtuba.com") {
        return null;
      }
      return mapWorldPath(`${url.pathname}${url.search}`);
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    return mapWorldPath(trimmed);
  }

  return null;
}

function mapWorldPath(pathWithQuery: string): string | null {
  const pathOnly = (pathWithQuery.split("?")[0] || "/").replace(/\/+$/, "") || "/";

  if (pathOnly === "/discover" || pathOnly === "/(tabs)/discover") {
    return "/(tabs)/discover";
  }
  if (pathOnly === "/live" || pathOnly === "/(tabs)/live") {
    return "/(tabs)/live";
  }
  if (pathOnly === "/watch" || pathOnly === "/(tabs)/watch") {
    return "/(tabs)/watch";
  }
  if (pathOnly === "/messages" || pathOnly === "/(tabs)/messages") {
    return "/(tabs)/messages";
  }
  if (pathOnly === "/profile") {
    return "/profile";
  }
  if (pathOnly === "/rewards") {
    return "/rewards";
  }
  if (pathOnly === "/notifications") {
    return "/notifications";
  }
  // World experience screen (stack). Tab alias remaps to the same surface.
  if (pathOnly === "/world" || pathOnly === "/(tabs)/world") {
    return "/world";
  }

  const profile = pathOnly.match(/^\/profile\/([^/]+)$/i);
  if (profile?.[1]) {
    return `/profile?u=${encodeURIComponent(profile[1])}`;
  }

  return null;
}

export function canOpenWorldDestination(
  raw: string | null | undefined
): boolean {
  return mapWorldDestination(raw) !== null;
}
