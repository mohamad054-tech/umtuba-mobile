import type { SupabaseClient } from "@supabase/supabase-js";

import type { WalletBalance } from "@/src/contracts/wallet";
import { fetchUmPointsWalletBalance } from "@/src/lib/wallet/fetchBalance";

export type WelcomeBonusClaimResult = {
  created: boolean;
  reason?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Authoritative one-time verified-welcome grant (DB default 100 UM Points).
 * Deduped server-side by `verified_welcome:{uid}`. Never invents a client balance.
 */
export async function claimVerifiedWelcomeBonus(
  supabase: SupabaseClient
): Promise<WelcomeBonusClaimResult> {
  const { data, error } = await supabase.rpc("claim_verified_welcome_bonus");
  if (error) {
    console.error("claim_verified_welcome_bonus failed:", error);
    return { created: false, reason: error.message };
  }
  const row = asRecord(data);
  return {
    created: Boolean(row?.created),
    reason: typeof row?.reason === "string" ? row.reason : undefined,
  };
}

/** Claim (idempotent) then read the server wallet. UI must display this amount. */
export async function loadWalletAfterWelcomeClaim(
  supabase: SupabaseClient,
  userId: string
): Promise<WalletBalance> {
  await claimVerifiedWelcomeBonus(supabase);
  return fetchUmPointsWalletBalance(supabase, userId);
}
