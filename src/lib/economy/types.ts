/**
 * UMTUBA Wallet & Economy foundation contracts.
 * Reuses PlatformEntity — no payment providers, gateways, or UI.
 *
 * Authority boundary:
 * - `src/lib/wallet` + `src/contracts/wallet` remain the current operational
 *   UM Points source of truth for balances shown in the app today.
 * - `src/lib/economy` is the provider-agnostic integration domain for future
 *   cross-module money/points flows (games, learning, store, etc.).
 * - Future adapters will bridge the existing UM Points wallet INTO economy.
 * - This module must NOT become a parallel balance authority and must NOT
 *   invent balances, currencies, or provider bindings.
 */

import type {
  PlatformDestination,
  PlatformEntity,
  PlatformPermission,
  PlatformPermissionId,
  PlatformVisibility,
} from "@/src/lib/platform";

export type WalletTransactionState =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded"
  | "future";

export type EconomyActionId =
  | "earn"
  | "spend"
  | "refund"
  | "transfer"
  | "reward"
  | "purchase"
  | "subscribe"
  | "withdraw"
  | "future";

/** Visibility for economic objects — aligned with platform visibility set. */
export type EconomyVisibility = PlatformVisibility;

export type WalletCapabilityId =
  | "view_balance"
  | "earn"
  | "spend"
  | "transfer"
  | "purchase"
  | "subscribe"
  | "refund"
  | "withdraw"
  | "games"
  | "learning"
  | "world"
  | "ads"
  | "store"
  | "creators"
  | "ai"
  | "notifications"
  | "messages"
  | "future";

/**
 * Wallet as a first-class platform entity.
 * Platform type must be "wallet" (not "reward").
 */
export type WalletEntity = {
  platformEntity: PlatformEntity;
  walletId: string;
  currencyCode: string | null;
};

export type WalletCurrency = {
  code: string;
  name: string | null;
  decimals: number | null;
  /** Opaque asset key from a trusted source — never invented. */
  assetRef: string | null;
};

/**
 * Parsed balance only — never invents amounts.
 * amount is required from trusted input; null amount is rejected at parse time.
 */
export type WalletBalance = {
  walletId: string;
  currencyCode: string;
  /** Minor units or decimal string from backend — stored as number only when finite. */
  amount: number;
  updatedAt: string | null;
};

export type WalletTransaction = {
  transactionId: string;
  walletId: string;
  action: EconomyActionId;
  state: WalletTransactionState;
  amount: number;
  currencyCode: string;
  createdAt: string | null;
  destination: PlatformDestination | null;
  ledgerRef: string | null;
};

export type WalletReward = {
  rewardId: string;
  walletId: string | null;
  userId: string | null;
  amount: number | null;
  currencyCode: string | null;
  rewardRef: string | null;
};

export type WalletPurchase = {
  purchaseId: string;
  walletId: string | null;
  userId: string | null;
  amount: number | null;
  currencyCode: string | null;
  state: WalletTransactionState | null;
  purchaseRef: string | null;
};

export type WalletSubscription = {
  subscriptionId: string;
  userId: string | null;
  planRef: string | null;
  state: WalletTransactionState | null;
  startedAt: string | null;
  endsAt: string | null;
};

export type WalletCredit = {
  creditId: string;
  walletId: string;
  amount: number;
  currencyCode: string;
  createdAt: string | null;
  creditRef: string | null;
};

export type WalletDebit = {
  debitId: string;
  walletId: string;
  amount: number;
  currencyCode: string;
  createdAt: string | null;
  debitRef: string | null;
};

export type WalletTransfer = {
  transferId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  currencyCode: string;
  state: WalletTransactionState | null;
  createdAt: string | null;
};

export type WalletRefund = {
  refundId: string;
  transactionId: string | null;
  walletId: string | null;
  amount: number | null;
  currencyCode: string | null;
  state: WalletTransactionState | null;
  refundRef: string | null;
};

export type WalletCapability = {
  id: WalletCapabilityId;
  enabled: boolean;
};

export type WalletPermission = {
  id: PlatformPermissionId;
  granted: boolean;
};

/** Opaque provider reference — no SDK binding. */
export type WalletProviderReference = {
  providerId: string;
  providerRef: string | null;
  label: string | null;
};

export type WalletReceiptReference = {
  receiptId: string;
  transactionId: string | null;
  receiptRef: string | null;
  createdAt: string | null;
};

export type WalletLedgerReference = {
  ledgerId: string;
  walletId: string | null;
  ledgerRef: string | null;
  updatedAt: string | null;
};

export type EconomyAction = {
  id: EconomyActionId;
  enabled: boolean;
  destination: PlatformDestination | null;
};

export type EconomyFoundationStatus =
  | "unavailable"
  | "empty"
  | "ready"
  | "error";

export type EconomyFoundationSnapshot = {
  status: EconomyFoundationStatus;
  message: string;
  capabilities: WalletCapability[];
  permissions: PlatformPermission[];
  currencies: WalletCurrency[];
  balances: WalletBalance[];
  visibilityDefault: EconomyVisibility;
};
