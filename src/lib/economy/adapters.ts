/**
 * Adapter interfaces only — no payment SDKs, gateways, or ledger writers.
 *
 * Binding policy:
 * - No adapter is bound in this foundation slice.
 * - A future UM Points bridge adapter may adapt `src/lib/wallet` into economy
 *   contracts; it must not create a second balance authority.
 */

import type {
  EconomyFoundationSnapshot,
  WalletBalance,
  WalletEntity,
  WalletTransaction,
} from "@/src/lib/economy/types";

export type WalletEntityAdapter = {
  readonly id: string;
  parseWallet(raw: unknown): WalletEntity | null;
};

export type WalletBalanceAdapter = {
  readonly id: string;
  parseBalance(raw: unknown): WalletBalance | null;
};

export type WalletTransactionAdapter = {
  readonly id: string;
  parseTransaction(raw: unknown): WalletTransaction | null;
};

export type EconomyFoundationAdapter = {
  readonly id: string;
  getSnapshot(): EconomyFoundationSnapshot;
};

/** Always false until a trusted bridge adapter is registered. */
export function isEconomyAdapterBound(): boolean {
  return false;
}

/** Always false — no Stripe/PayPal/IAP/etc. in this foundation. */
export function isPaymentProviderBound(): boolean {
  return false;
}
