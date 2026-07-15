/**
 * Activity tiers — framework-neutral copy of web lib/activity-tiers.
 * Separate from the wallet — UM Points must never change rank.
 */

export type ActivityTierId =
  | "spark"
  | "rising"
  | "creator"
  | "pathfinder"
  | "luminary"
  | "icon";

export type ActivityTierAccent =
  | "slate"
  | "sky"
  | "emerald"
  | "amber"
  | "violet"
  | "rose";

export type ActivityTierDefinition = {
  id: ActivityTierId;
  rank: number;
  threshold: number;
  name: string;
  displayLabel: string;
  displayTitle: string;
  icon: string;
  accent: ActivityTierAccent;
  description: string;
};

export type ActivityTierProgress = {
  score: number;
  tierId: ActivityTierId;
  tier: ActivityTierDefinition;
  nextTier: ActivityTierDefinition | null;
  progressPercent: number;
  pointsToNext: number;
  updatedAt: string | null;
};

export const ACTIVITY_TIERS: readonly ActivityTierDefinition[] = [
  {
    id: "spark",
    rank: 0,
    threshold: 0,
    name: "spark",
    displayLabel: "Spark",
    displayTitle: "Spark",
    icon: "◇",
    accent: "slate",
    description: "Getting started on UMTUBA.",
  },
  {
    id: "rising",
    rank: 1,
    threshold: 250,
    name: "rising",
    displayLabel: "Rising",
    displayTitle: "Rising Creator",
    icon: "△",
    accent: "sky",
    description: "Building authentic posting and community habits.",
  },
  {
    id: "creator",
    rank: 2,
    threshold: 1000,
    name: "creator",
    displayLabel: "Creator",
    displayTitle: "Creator",
    icon: "✦",
    accent: "emerald",
    description: "Consistent quality posts and helpful engagement.",
  },
  {
    id: "pathfinder",
    rank: 3,
    threshold: 3500,
    name: "pathfinder",
    displayLabel: "Pathfinder",
    displayTitle: "Pathfinder",
    icon: "◈",
    accent: "amber",
    description: "Live participation and community contributions.",
  },
  {
    id: "luminary",
    rank: 4,
    threshold: 10_000,
    name: "luminary",
    displayLabel: "Luminary",
    displayTitle: "Luminary",
    icon: "☀",
    accent: "violet",
    description: "Trusted presence with verified referrals and tenure.",
  },
  {
    id: "icon",
    rank: 5,
    threshold: 25_000,
    name: "icon",
    displayLabel: "Icon",
    displayTitle: "Icon",
    icon: "★",
    accent: "rose",
    description: "Top-tier authentic activity across UMTUBA.",
  },
] as const;

export const DEFAULT_ACTIVITY_TIER_ID: ActivityTierId = "spark";

const TIER_BY_ID = Object.fromEntries(
  ACTIVITY_TIERS.map((tier) => [tier.id, tier])
) as Record<ActivityTierId, ActivityTierDefinition>;

export function getActivityTierById(
  id: ActivityTierId
): ActivityTierDefinition {
  return TIER_BY_ID[id] ?? TIER_BY_ID[DEFAULT_ACTIVITY_TIER_ID];
}

export function isActivityTierId(value: unknown): value is ActivityTierId {
  return typeof value === "string" && value in TIER_BY_ID;
}

/** Resolve tier from authentic activity score (thresholds are inclusive). */
export function resolveTierFromScore(score: number): ActivityTierDefinition {
  const safe = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  let current = ACTIVITY_TIERS[0]!;

  for (const tier of ACTIVITY_TIERS) {
    if (safe >= tier.threshold) {
      current = tier;
    } else {
      break;
    }
  }

  return current;
}

export function getNextActivityTier(
  tierId: ActivityTierId
): ActivityTierDefinition | null {
  const current = getActivityTierById(tierId);
  return ACTIVITY_TIERS.find((tier) => tier.rank === current.rank + 1) ?? null;
}

export function computeTierProgressPercent(
  score: number,
  current: ActivityTierDefinition,
  next: ActivityTierDefinition | null
): number {
  if (!next) {
    return 100;
  }

  const safe = Number.isFinite(score) ? Math.max(0, score) : 0;
  const span = next.threshold - current.threshold;
  if (span <= 0) {
    return 100;
  }

  const progressed = safe - current.threshold;
  return Math.max(0, Math.min(100, Math.round((progressed / span) * 100)));
}

export function buildActivityTierProgress(input: {
  score: number;
  tierId?: ActivityTierId | null;
  updatedAt?: string | null;
}): ActivityTierProgress {
  const score = Number.isFinite(input.score)
    ? Math.max(0, Math.floor(input.score))
    : 0;
  const resolved = resolveTierFromScore(score);
  const tier =
    input.tierId && input.tierId === resolved.id
      ? getActivityTierById(input.tierId)
      : resolved;
  const nextTier = getNextActivityTier(tier.id);
  const progressPercent = computeTierProgressPercent(score, tier, nextTier);
  const pointsToNext = nextTier
    ? Math.max(0, nextTier.threshold - score)
    : 0;

  return {
    score,
    tierId: tier.id,
    tier,
    nextTier,
    progressPercent,
    pointsToNext,
    updatedAt: input.updatedAt ?? null,
  };
}

export function emptyActivityTierProgress(): ActivityTierProgress {
  return buildActivityTierProgress({
    score: 0,
    tierId: DEFAULT_ACTIVITY_TIER_ID,
    updatedAt: null,
  });
}
