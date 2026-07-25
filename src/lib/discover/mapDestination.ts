import type { Href } from "expo-router";

/**
 * Allow only known Discover → app destinations. Fail-closed otherwise.
 */
export function mapDiscoverDestination(
  raw: string | null | undefined
): Href | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject absolute / external URLs — Discover navigates in-app only.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return null;
  }

  if (trimmed === "/(tabs)/watch" || trimmed === "/watch") {
    return "/(tabs)/watch";
  }

  const watchPost = trimmed.match(
    /^(?:\/(?:\(tabs\)\/)?watch)\?post=(\d+)$/i
  );
  if (watchPost) {
    return {
      pathname: "/(tabs)/watch",
      params: { post: watchPost[1]! },
    };
  }

  if (trimmed === "/(tabs)/live" || trimmed === "/live") {
    return "/(tabs)/live";
  }

  if (trimmed === "/(tabs)/discover" || trimmed === "/discover") {
    return "/(tabs)/discover";
  }

  return null;
}

export function canOpenDiscoverDestination(
  raw: string | null | undefined
): boolean {
  return mapDiscoverDestination(raw) !== null;
}

export function watchPostDestination(postId: number | null | undefined): Href | null {
  if (postId == null || !Number.isFinite(postId) || postId <= 0) {
    return null;
  }
  return {
    pathname: "/(tabs)/watch",
    params: { post: String(Math.trunc(postId)) },
  };
}
