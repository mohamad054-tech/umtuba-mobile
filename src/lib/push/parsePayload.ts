import type { ParsedPushPayload } from "@/src/lib/push/types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(
  source: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return String(raw);
    }
  }
  return null;
}

function flattenData(raw: unknown): Record<string, string> {
  const record = asRecord(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
    }
  }
  return out;
}

/** Only app scheme, UMTUBA https hosts, and Expo dev URLs are navigable. */
export function isAllowedPushUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("..")) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("umtuba://")) return true;
  if (lower.startsWith("exp://")) return true;
  if (
    lower === "https://umtuba.com" ||
    lower.startsWith("https://umtuba.com/") ||
    lower.startsWith("https://umtuba.com?")
  ) {
    return true;
  }
  if (
    lower === "https://www.umtuba.com" ||
    lower.startsWith("https://www.umtuba.com/") ||
    lower.startsWith("https://www.umtuba.com?")
  ) {
    return true;
  }
  if (
    lower === "http://umtuba.com" ||
    lower.startsWith("http://umtuba.com/") ||
    lower.startsWith("http://umtuba.com?") ||
    lower === "http://www.umtuba.com" ||
    lower.startsWith("http://www.umtuba.com/") ||
    lower.startsWith("http://www.umtuba.com?")
  ) {
    return true;
  }
  return false;
}

/**
 * Parse a notification content/data blob into a navigation-friendly payload.
 * Does not hardcode product categories — unknown categories pass through.
 */
export function parsePushPayload(input: {
  title?: string | null;
  body?: string | null;
  data?: unknown;
}): ParsedPushPayload {
  const data = flattenData(input.data);
  const nested = asRecord(
    input.data && typeof input.data === "object"
      ? (input.data as Record<string, unknown>).payload ??
          (input.data as Record<string, unknown>).data
      : null
  );
  const nestedFlat = flattenData(nested);
  const merged = { ...nestedFlat, ...data };

  const category =
    readString(merged as unknown as Record<string, unknown>, [
      "category",
      "type",
      "kind",
    ]) ?? null;

  const url =
    readString(merged as unknown as Record<string, unknown>, [
      "url",
      "deepLink",
      "deeplink",
      "link",
    ]) ?? null;

  const path =
    readString(merged as unknown as Record<string, unknown>, [
      "path",
      "href",
      "route",
      "screen",
    ]) ?? null;

  return {
    category,
    title: input.title?.trim() || readString(merged as never, ["title"]) || null,
    body:
      input.body?.trim() ||
      readString(merged as never, ["body", "message"]) ||
      null,
    url,
    path,
    data: merged,
  };
}

export type PushHrefResolver = {
  /** Return an app href, or null when the URL is unknown/unsupported. */
  resolveUrl: (url: string) => string | null;
};

/**
 * Resolve an Expo Router href from a parsed payload.
 * External schemes and unknown routes are rejected (caller should fall back safely).
 */
export function resolvePushNavigationHref(
  payload: ParsedPushPayload,
  resolver: PushHrefResolver
): string | null {
  if (payload.url) {
    if (!isAllowedPushUrl(payload.url)) {
      return null;
    }
    return resolver.resolveUrl(payload.url);
  }

  if (payload.path) {
    const path = payload.path.trim();
    if (!path || path.includes("..")) {
      return null;
    }
    // Absolute URLs mistakenly placed in `path` must still pass the allowlist.
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
      if (!isAllowedPushUrl(path)) {
        return null;
      }
      return resolver.resolveUrl(path);
    }
    const asAppUrl = `umtuba://${path.replace(/^\/+/, "")}`;
    if (!isAllowedPushUrl(asAppUrl)) {
      return null;
    }
    return resolver.resolveUrl(asAppUrl);
  }

  return null;
}
