import { normalizeReferralCode } from "@/src/contracts/referral";

export type DeepLinkTarget =
  | { type: "watch"; postId: number | null }
  | { type: "profile"; username: string | null }
  | { type: "live"; roomId: string | null }
  | { type: "invite"; code: string }
  | { type: "rewards" }
  | { type: "notifications" }
  | { type: "messages"; conversationId: string | null; messageId: string | null; creatorId: string | null }
  | { type: "signup"; ref: string | null }
  | { type: "login" }
  | { type: "forgot-password" }
  | { type: "update-password" }
  | { type: "unknown"; path: string };

export type ParsedDeepLink = {
  target: DeepLinkTarget;
  /** Referral code from path or query (first-touch candidate). */
  referralCode: string | null;
  rawUrl: string;
};

function stripPrefix(path: string): string {
  let p = path.trim();

  // Auth callbacks may append #access_token=… — route on path/query only.
  const hashIndex = p.indexOf("#");
  if (hashIndex >= 0) {
    p = p.slice(0, hashIndex);
  }

  if (p.startsWith("umtuba://")) {
    p = p.slice("umtuba://".length);
  } else if (p.startsWith("https://umtuba.com")) {
    p = p.slice("https://umtuba.com".length);
  } else if (p.startsWith("https://www.umtuba.com")) {
    p = p.slice("https://www.umtuba.com".length);
  } else if (p.startsWith("http://umtuba.com")) {
    p = p.slice("http://umtuba.com".length);
  } else if (p.startsWith("http://www.umtuba.com")) {
    p = p.slice("http://www.umtuba.com".length);
  } else if (/^exp:\/\//i.test(p)) {
    // Expo Go / Metro: exp://host:port/--/path
    const marker = "/--/";
    const markerIndex = p.indexOf(marker);
    if (markerIndex >= 0) {
      p = p.slice(markerIndex + marker.length - 1); // keep leading "/"
    } else {
      const withoutScheme = p.replace(/^exp:\/\//i, "");
      const slash = withoutScheme.indexOf("/");
      p = slash >= 0 ? withoutScheme.slice(slash) : "/";
    }
  }

  if (!p.startsWith("/")) {
    p = `/${p}`;
  }

  // Drop host-style umtuba:///path leftovers and Expo Router "/--/" prefix.
  p = p.replace(/^\/+/, "/");
  if (p.startsWith("/--/")) {
    p = p.slice(3);
  }
  return p;
}

function parseQuery(search: string): URLSearchParams {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q);
}

/**
 * Parse umtuba:// and https://umtuba.com paths for watch/profile/live/invite/
 * rewards/notifications (+ signup ref).
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  const rawUrl = url.trim();
  let pathWithQuery = stripPrefix(rawUrl);

  const qIndex = pathWithQuery.indexOf("?");
  const pathOnly =
    qIndex >= 0 ? pathWithQuery.slice(0, qIndex) : pathWithQuery;
  const query =
    qIndex >= 0 ? parseQuery(pathWithQuery.slice(qIndex)) : new URLSearchParams();

  const segments = pathOnly.split("/").filter(Boolean);
  const refFromQuery = normalizeReferralCode(query.get("ref"));

  if (segments.length === 0) {
    return {
      target: { type: "watch", postId: null },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  const head = segments[0]!.toLowerCase();

  if (head === "watch") {
    const postParam = query.get("post") ?? query.get("postId");
    const postId =
      postParam && /^\d+$/.test(postParam) ? Number(postParam) : null;
    return {
      target: { type: "watch", postId },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (head === "profile" || head === "u" || head === "@") {
    const username = (segments[1] ?? query.get("u") ?? "")
      .replace(/^@/, "")
      .toLowerCase() || null;
    return {
      target: { type: "profile", username },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (head === "live") {
    return {
      target: { type: "live", roomId: segments[1] ?? null },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (head === "invite" && segments[1]) {
    const code = normalizeReferralCode(segments[1]);
    return {
      target: code
        ? { type: "invite", code }
        : { type: "unknown", path: pathOnly },
      referralCode: code ?? refFromQuery,
      rawUrl,
    };
  }

  if (head === "rewards") {
    return {
      target: { type: "rewards" },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (head === "notifications") {
    return {
      target: { type: "notifications" },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (head === "messages") {
    const fromQuery = query.get("conversation");
    const fromPath =
      segments[1] &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segments[1]
      )
        ? segments[1]
        : null;
    const conversationId = fromQuery || fromPath || null;
    const messageId = query.get("message");
    const creatorId = query.get("creatorId");
    return {
      target: {
        type: "messages",
        conversationId,
        messageId,
        creatorId,
      },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (
    head === "signup" ||
    (head === "(auth)" && segments[1]?.toLowerCase() === "signup")
  ) {
    return {
      target: { type: "signup", ref: refFromQuery },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (head === "login") {
    return {
      target: { type: "login" },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (
    head === "forgot-password" ||
    head === "reset-password" ||
    (head === "auth" && segments[1]?.toLowerCase() === "forgot-password")
  ) {
    return {
      target: { type: "forgot-password" },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  if (
    head === "update-password" ||
    (head === "auth" && segments[1]?.toLowerCase() === "update-password")
  ) {
    return {
      target: { type: "update-password" },
      referralCode: refFromQuery,
      rawUrl,
    };
  }

  return {
    target: { type: "unknown", path: pathOnly },
    referralCode: refFromQuery,
    rawUrl,
  };
}

/** Map a parsed target to an expo-router href string. */
export function deepLinkToHref(target: DeepLinkTarget): string {
  switch (target.type) {
    case "watch":
      return target.postId
        ? `/(tabs)/watch?post=${target.postId}`
        : "/(tabs)/watch";
    case "profile":
      return target.username
        ? `/profile?u=${encodeURIComponent(target.username)}`
        : "/profile";
    case "live":
      return "/(tabs)/live";
    case "invite":
      return `/invite/${encodeURIComponent(target.code)}`;
    case "rewards":
      return "/rewards";
    case "notifications":
      return "/notifications";
    case "messages": {
      if (target.creatorId) {
        return `/(tabs)/messages?creatorId=${encodeURIComponent(target.creatorId)}`;
      }
      if (target.conversationId) {
        const base = `/messages/${encodeURIComponent(target.conversationId)}`;
        return target.messageId
          ? `${base}?message=${encodeURIComponent(target.messageId)}`
          : base;
      }
      return "/(tabs)/messages";
    }
    case "signup":
      return target.ref
        ? `/(auth)/signup?ref=${encodeURIComponent(target.ref)}`
        : "/(auth)/signup";
    case "login":
      return "/(auth)/login";
    case "forgot-password":
      return "/(auth)/forgot-password";
    case "update-password":
      // Full update-password UI ships in Phase 2; land on forgot flow for now.
      return "/(auth)/forgot-password";
    case "unknown":
      return "/";
  }
}
