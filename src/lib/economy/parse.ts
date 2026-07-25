import {
  parseEconomyActionId,
  parseWalletCapabilityId,
  parseWalletTransactionState,
} from "@/src/lib/economy/enums";
import type {
  EconomyAction,
  WalletBalance,
  WalletCapability,
  WalletCredit,
  WalletCurrency,
  WalletDebit,
  WalletEntity,
  WalletLedgerReference,
  WalletProviderReference,
  WalletPurchase,
  WalletReceiptReference,
  WalletRefund,
  WalletReward,
  WalletSubscription,
  WalletTransaction,
  WalletTransfer,
} from "@/src/lib/economy/types";
import {
  createPlatformDestination,
  parsePlatformEntity,
  parsePlatformPermission,
  parsePlatformVisibility,
  type PlatformEntity,
  type PlatformPermission,
} from "@/src/lib/platform";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanIso(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) return null;
  return text;
}

/** Finite number only — rejects NaN/Infinity; does not invent zero. */
function cleanAmount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function cleanDecimals(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.trunc(value);
}

export function toWalletEntity(
  platformEntity: PlatformEntity,
  extras: { walletId: string; currencyCode?: string | null }
): WalletEntity | null {
  if (platformEntity.type !== "wallet") return null;
  const walletId = cleanText(extras.walletId);
  if (!walletId) return null;
  return {
    platformEntity,
    walletId,
    currencyCode: cleanText(extras.currencyCode ?? null),
  };
}

/**
 * Optional platform-backed wrappers for economy objects.
 * Each requires the matching PlatformEntityType — never "reward" unless it is a reward.
 */
export function requirePlatformEntityType(
  platformEntity: PlatformEntity,
  expected: PlatformEntity["type"]
): PlatformEntity | null {
  return platformEntity.type === expected ? platformEntity : null;
}

export function parseWalletEntity(raw: unknown): WalletEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const platformRaw =
    r.platformEntity && typeof r.platformEntity === "object"
      ? r.platformEntity
      : {
          id: r.id,
          type: r.type ?? "wallet",
          title: r.title ?? r.name,
          subtitle: r.subtitle,
          module: r.module ?? "rewards",
          visibility: r.visibility ?? "private",
          ownership: r.ownership ?? "self",
          destination: r.destination ?? r.href,
          metadata: r.metadata ?? {},
        };

  const platformEntity = parsePlatformEntity(platformRaw);
  if (!platformEntity) return null;

  return toWalletEntity(platformEntity, {
    walletId:
      cleanText(r.walletId) ?? cleanText(r.wallet_id) ?? platformEntity.id,
    currencyCode: cleanText(r.currencyCode) ?? cleanText(r.currency_code),
  });
}

export function parseWalletCurrency(raw: unknown): WalletCurrency | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const code = cleanText(r.code) ?? cleanText(r.currency_code);
  if (!code) return null;
  return {
    code,
    name: cleanText(r.name) ?? cleanText(r.display_name),
    decimals: cleanDecimals(r.decimals),
    assetRef: cleanText(r.assetRef) ?? cleanText(r.asset_ref),
  };
}

/**
 * Balance requires trusted walletId, currencyCode, and finite amount.
 * Missing amount fails closed (no fake 0).
 */
export function parseWalletBalance(raw: unknown): WalletBalance | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const walletId = cleanText(r.walletId) ?? cleanText(r.wallet_id);
  const currencyCode =
    cleanText(r.currencyCode) ?? cleanText(r.currency_code);
  const amount = cleanAmount(r.amount);
  if (!walletId || !currencyCode || amount == null) return null;
  return {
    walletId,
    currencyCode,
    amount,
    updatedAt: cleanIso(r.updatedAt) ?? cleanIso(r.updated_at),
  };
}

export function parseWalletTransaction(raw: unknown): WalletTransaction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const transactionId =
    cleanText(r.transactionId) ?? cleanText(r.transaction_id);
  const walletId = cleanText(r.walletId) ?? cleanText(r.wallet_id);
  const action = parseEconomyActionId(
    cleanText(r.action) ?? cleanText(r.action_id)
  );
  const state = parseWalletTransactionState(cleanText(r.state));
  const amount = cleanAmount(r.amount);
  const currencyCode =
    cleanText(r.currencyCode) ?? cleanText(r.currency_code);
  if (
    !transactionId ||
    !walletId ||
    !action ||
    !state ||
    amount == null ||
    !currencyCode
  ) {
    return null;
  }
  const destinationRaw = cleanText(r.destination) ?? cleanText(r.href);
  return {
    transactionId,
    walletId,
    action,
    state,
    amount,
    currencyCode,
    createdAt: cleanIso(r.createdAt) ?? cleanIso(r.created_at),
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
    ledgerRef: cleanText(r.ledgerRef) ?? cleanText(r.ledger_ref),
  };
}

export function parseWalletReward(raw: unknown): WalletReward | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rewardId = cleanText(r.rewardId) ?? cleanText(r.reward_id);
  if (!rewardId) return null;
  return {
    rewardId,
    walletId: cleanText(r.walletId) ?? cleanText(r.wallet_id),
    userId: cleanText(r.userId) ?? cleanText(r.user_id),
    amount: cleanAmount(r.amount),
    currencyCode: cleanText(r.currencyCode) ?? cleanText(r.currency_code),
    rewardRef: cleanText(r.rewardRef) ?? cleanText(r.reward_ref),
  };
}

export function parseWalletPurchase(raw: unknown): WalletPurchase | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const purchaseId = cleanText(r.purchaseId) ?? cleanText(r.purchase_id);
  if (!purchaseId) return null;
  const stateRaw = cleanText(r.state);
  const state = stateRaw ? parseWalletTransactionState(stateRaw) : null;
  if (stateRaw && !state) return null;
  return {
    purchaseId,
    walletId: cleanText(r.walletId) ?? cleanText(r.wallet_id),
    userId: cleanText(r.userId) ?? cleanText(r.user_id),
    amount: cleanAmount(r.amount),
    currencyCode: cleanText(r.currencyCode) ?? cleanText(r.currency_code),
    state,
    purchaseRef: cleanText(r.purchaseRef) ?? cleanText(r.purchase_ref),
  };
}

export function parseWalletSubscription(raw: unknown): WalletSubscription | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const subscriptionId =
    cleanText(r.subscriptionId) ?? cleanText(r.subscription_id);
  if (!subscriptionId) return null;
  const stateRaw = cleanText(r.state);
  const state = stateRaw ? parseWalletTransactionState(stateRaw) : null;
  if (stateRaw && !state) return null;
  return {
    subscriptionId,
    userId: cleanText(r.userId) ?? cleanText(r.user_id),
    planRef: cleanText(r.planRef) ?? cleanText(r.plan_ref),
    state,
    startedAt: cleanIso(r.startedAt) ?? cleanIso(r.started_at),
    endsAt: cleanIso(r.endsAt) ?? cleanIso(r.ends_at),
  };
}

export function parseWalletCredit(raw: unknown): WalletCredit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const creditId = cleanText(r.creditId) ?? cleanText(r.credit_id);
  const walletId = cleanText(r.walletId) ?? cleanText(r.wallet_id);
  const amount = cleanAmount(r.amount);
  const currencyCode =
    cleanText(r.currencyCode) ?? cleanText(r.currency_code);
  if (!creditId || !walletId || amount == null || !currencyCode) return null;
  return {
    creditId,
    walletId,
    amount,
    currencyCode,
    createdAt: cleanIso(r.createdAt) ?? cleanIso(r.created_at),
    creditRef: cleanText(r.creditRef) ?? cleanText(r.credit_ref),
  };
}

export function parseWalletDebit(raw: unknown): WalletDebit | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const debitId = cleanText(r.debitId) ?? cleanText(r.debit_id);
  const walletId = cleanText(r.walletId) ?? cleanText(r.wallet_id);
  const amount = cleanAmount(r.amount);
  const currencyCode =
    cleanText(r.currencyCode) ?? cleanText(r.currency_code);
  if (!debitId || !walletId || amount == null || !currencyCode) return null;
  return {
    debitId,
    walletId,
    amount,
    currencyCode,
    createdAt: cleanIso(r.createdAt) ?? cleanIso(r.created_at),
    debitRef: cleanText(r.debitRef) ?? cleanText(r.debit_ref),
  };
}

export function parseWalletTransfer(raw: unknown): WalletTransfer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const transferId = cleanText(r.transferId) ?? cleanText(r.transfer_id);
  const fromWalletId =
    cleanText(r.fromWalletId) ?? cleanText(r.from_wallet_id);
  const toWalletId = cleanText(r.toWalletId) ?? cleanText(r.to_wallet_id);
  const amount = cleanAmount(r.amount);
  const currencyCode =
    cleanText(r.currencyCode) ?? cleanText(r.currency_code);
  if (
    !transferId ||
    !fromWalletId ||
    !toWalletId ||
    amount == null ||
    !currencyCode
  ) {
    return null;
  }
  const stateRaw = cleanText(r.state);
  const state = stateRaw ? parseWalletTransactionState(stateRaw) : null;
  if (stateRaw && !state) return null;
  return {
    transferId,
    fromWalletId,
    toWalletId,
    amount,
    currencyCode,
    state,
    createdAt: cleanIso(r.createdAt) ?? cleanIso(r.created_at),
  };
}

export function parseWalletRefund(raw: unknown): WalletRefund | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const refundId = cleanText(r.refundId) ?? cleanText(r.refund_id);
  if (!refundId) return null;
  const stateRaw = cleanText(r.state);
  const state = stateRaw ? parseWalletTransactionState(stateRaw) : null;
  if (stateRaw && !state) return null;
  return {
    refundId,
    transactionId:
      cleanText(r.transactionId) ?? cleanText(r.transaction_id),
    walletId: cleanText(r.walletId) ?? cleanText(r.wallet_id),
    amount: cleanAmount(r.amount),
    currencyCode: cleanText(r.currencyCode) ?? cleanText(r.currency_code),
    state,
    refundRef: cleanText(r.refundRef) ?? cleanText(r.refund_ref),
  };
}

export function parseWalletCapability(raw: unknown): WalletCapability | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parseWalletCapabilityId(
    cleanText(r.id) ?? cleanText(r.capability)
  );
  if (!id) return null;
  return { id, enabled: r.enabled === true };
}

export function parseWalletProviderReference(
  raw: unknown
): WalletProviderReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const providerId = cleanText(r.providerId) ?? cleanText(r.provider_id);
  if (!providerId) return null;
  return {
    providerId,
    providerRef: cleanText(r.providerRef) ?? cleanText(r.provider_ref),
    label: cleanText(r.label) ?? cleanText(r.name),
  };
}

export function parseWalletReceiptReference(
  raw: unknown
): WalletReceiptReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const receiptId = cleanText(r.receiptId) ?? cleanText(r.receipt_id);
  if (!receiptId) return null;
  return {
    receiptId,
    transactionId:
      cleanText(r.transactionId) ?? cleanText(r.transaction_id),
    receiptRef: cleanText(r.receiptRef) ?? cleanText(r.receipt_ref),
    createdAt: cleanIso(r.createdAt) ?? cleanIso(r.created_at),
  };
}

export function parseWalletLedgerReference(
  raw: unknown
): WalletLedgerReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ledgerId = cleanText(r.ledgerId) ?? cleanText(r.ledger_id);
  if (!ledgerId) return null;
  return {
    ledgerId,
    walletId: cleanText(r.walletId) ?? cleanText(r.wallet_id),
    ledgerRef: cleanText(r.ledgerRef) ?? cleanText(r.ledger_ref),
    updatedAt: cleanIso(r.updatedAt) ?? cleanIso(r.updated_at),
  };
}

export function parseEconomyAction(raw: unknown): EconomyAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parseEconomyActionId(cleanText(r.id) ?? cleanText(r.action));
  if (!id) return null;
  const destinationRaw = cleanText(r.destination) ?? cleanText(r.href);
  return {
    id,
    enabled: r.enabled === true,
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
  };
}

export function parseEconomyVisibility(raw: unknown) {
  return parsePlatformVisibility(
    typeof raw === "string" ? raw : cleanText(raw)
  );
}

export function parseWalletPermissions(raw: unknown): PlatformPermission[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parsePlatformPermission)
    .filter((p): p is PlatformPermission => Boolean(p));
}
