import type { Href } from "expo-router";

/**
 * Allow only known in-app Live destinations. Fail-closed for everything else.
 * Room deep-links currently resolve to the Live lobby only (no join contract).
 */
export function mapLiveDestination(
  raw: string | null | undefined
): Href | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("..")) return null;

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    // Absolute URLs are not trusted join targets on mobile foundation.
    try {
      const url = new URL(trimmed);
      const host = url.hostname.toLowerCase();
      if (host !== "umtuba.com" && host !== "www.umtuba.com") {
        return null;
      }
      return mapLivePath(`${url.pathname}${url.search}`);
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    return mapLivePath(trimmed);
  }

  return null;
}

function mapLivePath(pathWithQuery: string): Href | null {
  const pathOnly = pathWithQuery.split("?")[0] ?? pathWithQuery;
  const normalized = pathOnly.replace(/\/+$/, "") || "/";

  if (
    normalized === "/live" ||
    normalized === "/(tabs)/live" ||
    /^\/live\/[^/]+$/.test(normalized)
  ) {
    // Room segments are acknowledged but join is deferred — lobby only.
    return "/(tabs)/live";
  }

  return null;
}

export function canOpenLiveDestination(
  raw: string | null | undefined
): boolean {
  return mapLiveDestination(raw) !== null;
}
