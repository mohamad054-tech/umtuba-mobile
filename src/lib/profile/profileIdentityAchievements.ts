/**
 * Optional achievement medals. Hide-when-empty.
 * No invented medals — mobile has no achievements column.
 */

export const PROFILE_IDENTITY_ACHIEVEMENT_MEDAL_MAX = 3;

export type NormalizedAchievementMedals = {
  visible: string[];
  overflowCount: number;
};

function normalizeLabels(
  values: readonly string[] | null | undefined,
  max: number
): string[] {
  if (!values?.length || max <= 0) {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values) {
    const label = raw.trim();
    if (!label) {
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(label);
    if (out.length >= max) {
      break;
    }
  }

  return out;
}

function countUniqueLabels(
  values: readonly string[] | null | undefined
): number {
  if (!values?.length) {
    return 0;
  }
  const seen = new Set<string>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) {
      continue;
    }
    seen.add(label.toLowerCase());
  }
  return seen.size;
}

export function normalizeAchievementMedals(
  achievements: readonly string[] | null | undefined
): NormalizedAchievementMedals {
  const visible = normalizeLabels(
    achievements,
    PROFILE_IDENTITY_ACHIEVEMENT_MEDAL_MAX
  );
  const total = countUniqueLabels(achievements);
  return {
    visible,
    overflowCount: Math.max(0, total - visible.length),
  };
}

export function shouldShowIdentityAchievements(
  achievements: readonly string[] | null | undefined
): boolean {
  return normalizeAchievementMedals(achievements).visible.length > 0;
}
