const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Allow only known in-app messenger destinations. Fail-closed otherwise.
 */
export function mapMessengerDestination(
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
      return mapMessengerPath(`${url.pathname}${url.search}`);
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/")) {
    return mapMessengerPath(trimmed);
  }

  return null;
}

function mapMessengerPath(pathWithQuery: string): string | null {
  const [pathOnly, query = ""] = pathWithQuery.split("?");
  const normalized = (pathOnly || "/").replace(/\/+$/, "") || "/";

  if (
    normalized === "/messages" ||
    normalized === "/(tabs)/messages"
  ) {
    return "/(tabs)/messages";
  }

  const thread = normalized.match(/^\/messages\/([^/]+)$/i);
  if (thread && UUID_RE.test(thread[1]!)) {
    const params = new URLSearchParams(query);
    const message = params.get("message");
    if (message && UUID_RE.test(message)) {
      return `/messages/${thread[1]}?message=${message}`;
    }
    return `/messages/${thread[1]}`;
  }

  return null;
}

export function canOpenMessengerDestination(
  raw: string | null | undefined
): boolean {
  return mapMessengerDestination(raw) !== null;
}

export function conversationThreadHref(
  conversationId: string | null | undefined,
  messageId?: string | null
): string | null {
  if (!conversationId || !UUID_RE.test(conversationId)) return null;
  if (messageId && UUID_RE.test(messageId)) {
    return `/messages/${conversationId}?message=${messageId}`;
  }
  return `/messages/${conversationId}`;
}
