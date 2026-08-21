/**
 * Role + interest teasers. Hide-when-empty.
 * No invented roles/interests — mobile has no those columns.
 */

export const PROFILE_IDENTITY_ROLE_CHIP_MAX = 2;
export const PROFILE_IDENTITY_INTEREST_TEASER_MAX = 2;

export type NormalizedRoleChips = {
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

export function normalizeRoleChips(
  roles: readonly string[] | null | undefined
): NormalizedRoleChips {
  const visible = normalizeLabels(roles, PROFILE_IDENTITY_ROLE_CHIP_MAX);
  const total = countUniqueLabels(roles);
  return {
    visible,
    overflowCount: Math.max(0, total - visible.length),
  };
}

export function normalizeInterestTeasers(
  interests: readonly string[] | null | undefined
): string[] {
  return normalizeLabels(interests, PROFILE_IDENTITY_INTEREST_TEASER_MAX);
}

export function shouldShowIdentityStrip(input: {
  roles?: readonly string[] | null;
  interests?: readonly string[] | null;
}): boolean {
  const roles = normalizeRoleChips(input.roles);
  if (roles.visible.length > 0) {
    return true;
  }
  return normalizeInterestTeasers(input.interests).length > 0;
}
