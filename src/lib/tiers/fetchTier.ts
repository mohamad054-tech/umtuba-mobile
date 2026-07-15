import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildActivityTierProgress,
  emptyActivityTierProgress,
  isActivityTierId,
  type ActivityTierProgress,
} from "@/src/contracts/tiers";

type SnapshotRow = {
  score?: unknown;
  tier_id?: unknown;
  tierId?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
  ok?: unknown;
};

function parseSnapshot(raw: unknown): ActivityTierProgress {
  if (!raw || typeof raw !== "object") {
    return emptyActivityTierProgress();
  }

  const row = raw as SnapshotRow;
  if (row.ok === false) {
    return emptyActivityTierProgress();
  }

  const score =
    typeof row.score === "number" && Number.isFinite(row.score)
      ? Math.max(0, Math.floor(row.score))
      : 0;
  const tierRaw = row.tierId ?? row.tier_id;
  const tierId = isActivityTierId(tierRaw) ? tierRaw : undefined;
  const updatedAtRaw = row.updatedAt ?? row.updated_at;
  const updatedAt = typeof updatedAtRaw === "string" ? updatedAtRaw : null;

  return buildActivityTierProgress({ score, tierId, updatedAt });
}

/**
 * Prefer `get_my_activity_tier_summary` RPC; fall back to
 * `activity_score_balances` table read.
 */
export async function getMyActivityTierProgress(
  supabase: SupabaseClient,
  userId?: string | null
): Promise<ActivityTierProgress> {
  const { data, error } = await supabase.rpc("get_my_activity_tier_summary");
  if (!error && data) {
    return parseSnapshot(data);
  }

  if (error) {
    console.error("get_my_activity_tier_summary failed:", error.message);
  }

  if (!userId) {
    return emptyActivityTierProgress();
  }

  const { data: row, error: tableError } = await supabase
    .from("activity_score_balances")
    .select("score, tier_id, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (tableError) {
    console.error("activity_score_balances read failed:", tableError.message);
    return emptyActivityTierProgress();
  }

  if (!row) {
    return emptyActivityTierProgress();
  }

  return parseSnapshot({
    ok: true,
    score: (row as { score?: unknown }).score,
    tier_id: (row as { tier_id?: unknown }).tier_id,
    updated_at: (row as { updated_at?: unknown }).updated_at,
  });
}
