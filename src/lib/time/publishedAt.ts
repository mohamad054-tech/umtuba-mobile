/**
 * Publication timestamp contract.
 *
 * posts has no published_at column. created_at is the server DEFAULT now()
 * assigned on insert — clients must not send created_at / published_at /
 * updated_at. Visible "published" time = created_at (historical fallback).
 * Never use the device clock as the value. Never use updated_at.
 */

export const AUTHORITATIVE_PUBLISH_TIMESTAMP = "created_at" as const;

export const FORBIDDEN_CLIENT_PUBLISH_TIME_KEYS = [
  "created_at",
  "published_at",
  "updated_at",
] as const;

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

export function parseServerDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Prefer published_at when a future schema adds it; otherwise created_at.
 * updated_at is never used.
 */
export function resolveAuthoritativePublishedAt(input: {
  published_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}): string | null {
  const published = parseServerDate(input.published_at);
  if (published) {
    return typeof input.published_at === "string" ? input.published_at.trim() : null;
  }
  const created = parseServerDate(input.created_at);
  if (created) {
    return typeof input.created_at === "string" ? input.created_at.trim() : null;
  }
  return null;
}

export function clientWriteOmitsPublishClock(
  row: Record<string, unknown>
): boolean {
  return FORBIDDEN_CLIENT_PUBLISH_TIME_KEYS.every((key) => !(key in row));
}

export function normalizeFormatLocale(locale: string | null | undefined): string {
  const raw = (locale ?? "en").trim() || "en";
  const lower = raw.toLowerCase();
  if (lower === "zh-cn" || lower === "zh") return "zh-CN";
  if (lower === "pt-br" || lower === "pt") return "pt-BR";
  if (lower === "ja" || lower === "ja-jp") return "ja-JP";
  if (lower === "ko" || lower === "ko-kr") return "ko-KR";
  if (lower === "id" || lower === "id-id") return "id-ID";
  if (lower === "hi" || lower === "hi-in") return "hi-IN";
  if (lower === "ru" || lower === "ru-ru") return "ru-RU";
  if (lower === "tr" || lower === "tr-tr") return "tr-TR";
  return raw;
}

/**
 * Viewer-local timezone unless `timeZone` is passed (tests use UTC).
 * Hard-coded month names are forbidden — Intl supplies them.
 */
export function formatPublishedAt(
  iso: string | null | undefined,
  locale: string,
  timeZone?: string
): string {
  const date = parseServerDate(iso);
  if (!date) return "";
  const options: Intl.DateTimeFormatOptions = timeZone
    ? { ...DATE_TIME_OPTIONS, timeZone }
    : { ...DATE_TIME_OPTIONS };
  try {
    return new Intl.DateTimeFormat(normalizeFormatLocale(locale), options)
      .format(date)
      .replace(/\u202f/g, " ")
      .replace(/\u00a0/g, " ");
  } catch {
    try {
      return new Intl.DateTimeFormat("en", options)
        .format(date)
        .replace(/\u202f/g, " ")
        .replace(/\u00a0/g, " ");
    } catch {
      return "";
    }
  }
}
