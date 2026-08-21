/**
 * Hero / About joined line. Formats existing `profiles.created_at` only.
 * No new schema. Does not invent a joined date.
 */

import { getLocaleDefinition, type AppLocale } from "@/src/lib/i18n/locales";

/** Strip a leading “Joined” word (case-insensitive) from a label. */
export function stripJoinedPrefix(raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) {
    return "";
  }
  return value.replace(/^joined\s+/i, "").trim();
}

/**
 * Date/phrase only (no duplicate “Joined” prefix) for About and for i18n
 * interpolation into `profile.joinedLine`.
 */
export function formatAboutJoinedBody(
  joinedLabel: string | null | undefined
): string | null {
  const datePart = stripJoinedPrefix(joinedLabel);
  return datePart || null;
}

/** Locale month + year from an existing ISO `created_at`. Invalid → null. */
export function formatJoinedMonthYear(
  iso: string | null | undefined,
  locale: AppLocale
): string | null {
  const value = iso?.trim() ?? "";
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(getLocaleDefinition(locale).bcp47, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return null;
  }
}
