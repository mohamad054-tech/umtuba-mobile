import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PRIMARY_WALLET_ASSET_ID,
  type WalletBalance,
} from "@/src/contracts/wallet";

/**
 * Reads the signed-in user's UM Points balance from `um_point_balances`
 * (RLS: own rows only).
 *
 * This is the operational UM Points read path. Do not replace it with
 * `src/lib/economy` balances; economy remains contract-only until a bridge
 * adapter is bound.
 */
export async function fetchUmPointsWalletBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<WalletBalance> {
  const { data, error } = await supabase
    .from("um_point_balances")
    .select("balance, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load wallet balance.");
  }

  const balance =
    data && typeof (data as { balance?: unknown }).balance === "number"
      ? Number((data as { balance: number }).balance)
      : 0;

  const updatedAt =
    data && typeof (data as { updated_at?: unknown }).updated_at === "string"
      ? (data as { updated_at: string }).updated_at
      : null;

  return {
    assetId: PRIMARY_WALLET_ASSET_ID,
    amount: Number.isFinite(balance) ? balance : 0,
    updatedAt,
  };
}
