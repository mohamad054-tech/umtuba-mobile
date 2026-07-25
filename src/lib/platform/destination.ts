/**
 * Platform-wide safe destination mapping.
 * Allowlist only — unknown routes fail closed.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mapPlatformDestination(
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
      return mapPlatformPath(`${url.pathname}${url.search}`);
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    return mapPlatformPath(trimmed);
  }

  return null;
}

function mapPlatformPath(pathWithQuery: string): string | null {
  const [pathPart, query = ""] = pathWithQuery.split("?");
  const pathOnly = (pathPart || "/").replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(query);

  if (pathOnly === "/discover" || pathOnly === "/(tabs)/discover") {
    return "/(tabs)/discover";
  }
  if (pathOnly === "/watch" || pathOnly === "/(tabs)/watch") {
    const post = params.get("post");
    if (post && /^\d+$/.test(post)) {
      return `/(tabs)/watch?post=${post}`;
    }
    return "/(tabs)/watch";
  }
  if (pathOnly === "/live" || pathOnly === "/(tabs)/live") {
    return "/(tabs)/live";
  }
  if (pathOnly === "/messages" || pathOnly === "/(tabs)/messages") {
    return "/(tabs)/messages";
  }
  const messageThread = pathOnly.match(/^\/messages\/([^/]+)$/i);
  if (messageThread && UUID_RE.test(messageThread[1]!)) {
    const message = params.get("message");
    if (message && UUID_RE.test(message)) {
      return `/messages/${messageThread[1]}?message=${message}`;
    }
    return `/messages/${messageThread[1]}`;
  }
  if (pathOnly === "/notifications") {
    return "/notifications";
  }
  if (pathOnly === "/rewards") {
    return "/rewards";
  }
  if (pathOnly === "/profile") {
    return "/profile";
  }
  if (pathOnly === "/settings") {
    return "/settings";
  }
  if (pathOnly === "/world" || pathOnly === "/(tabs)/world") {
    return "/world";
  }

  const profile = pathOnly.match(/^\/profile\/([^/]+)$/i);
  if (profile?.[1]) {
    return `/profile?u=${encodeURIComponent(profile[1])}`;
  }

  return null;
}

export function canOpenPlatformDestination(
  raw: string | null | undefined
): boolean {
  return mapPlatformDestination(raw) !== null;
}

export function createPlatformDestination(
  raw: string | null | undefined
): { raw: string; href: string | null } | null {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return null;
  return {
    raw: text,
    href: mapPlatformDestination(text),
  };
}
