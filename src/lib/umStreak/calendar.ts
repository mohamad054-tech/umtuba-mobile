import { UM_STREAK_TIMEZONE_POLICY } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Authoritative UM Streak day key.
 * Policy: UTC calendar date of the event instant (YYYY-MM-DD).
 * Viewer-local dates are display-only and must never award a streak day.
 */
export function utcDayKey(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid timestamp for UM Streak day.");
  }
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(dayKey: string, delta: number): string {
  const parsed = parseUtcDayKey(dayKey);
  return utcDayKey(new Date(parsed.getTime() + delta * DAY_MS));
}

export function previousUtcDay(dayKey: string): string {
  return addUtcDays(dayKey, -1);
}

export function utcDayDiff(later: string, earlier: string): number {
  const a = parseUtcDayKey(later).getTime();
  const b = parseUtcDayKey(earlier).getTime();
  return Math.round((a - b) / DAY_MS);
}

export function parseUtcDayKey(dayKey: string): Date {
  const match = DATE_RE.exec(dayKey);
  if (!match) {
    throw new Error(`Invalid UTC day key: ${dayKey}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid UTC day key: ${dayKey}`);
  }
  return date;
}

export function hoursRemainingInUtcDay(nowIso: string): number {
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid timestamp for remaining UTC day hours.");
  }
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  return Math.max(0, (nextMidnight - now.getTime()) / (60 * 60 * 1000));
}

export const STREAK_TIMEZONE_POLICY_NOTE = {
  policy: UM_STREAK_TIMEZONE_POLICY,
  awardRule:
    "Streak days are UTC calendar dates of the qualifying visual send. A modified client cannot supply a timezone or day key to award extra days.",
  displayRule:
    "UI may format the same UTC day in the viewer locale. Display timezone never changes server state.",
} as const;
