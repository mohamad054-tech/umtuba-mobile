import {
  UM_STREAK_BADGE_DAYS,
  type UmStreakBadge,
  type UmStreakBadgeDay,
} from "./types";

export function badgesFromLongest(
  longestStreak: number,
  earnedAtByDays?: Partial<Record<UmStreakBadgeDay, string | null>>
): UmStreakBadge[] {
  return UM_STREAK_BADGE_DAYS.map((days) => ({
    days,
    earned: longestStreak >= days,
    earnedAt: longestStreak >= days ? earnedAtByDays?.[days] ?? null : null,
  }));
}

export function newlyEarnedBadges(
  previousLongest: number,
  nextLongest: number
): UmStreakBadgeDay[] {
  return UM_STREAK_BADGE_DAYS.filter(
    (days) => previousLongest < days && nextLongest >= days
  );
}
