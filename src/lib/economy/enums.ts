import type {
  EconomyActionId,
  WalletCapabilityId,
  WalletTransactionState,
} from "@/src/lib/economy/types";

const TX_STATES = new Set<WalletTransactionState>([
  "pending",
  "completed",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "future",
]);

const ACTIONS = new Set<EconomyActionId>([
  "earn",
  "spend",
  "refund",
  "transfer",
  "reward",
  "purchase",
  "subscribe",
  "withdraw",
  "future",
]);

const CAPABILITIES = new Set<WalletCapabilityId>([
  "view_balance",
  "earn",
  "spend",
  "transfer",
  "purchase",
  "subscribe",
  "refund",
  "withdraw",
  "games",
  "learning",
  "world",
  "ads",
  "store",
  "creators",
  "ai",
  "notifications",
  "messages",
  "future",
]);

function normalize(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return key.length > 0 ? key : null;
}

export function parseWalletTransactionState(
  raw: string | null | undefined
): WalletTransactionState | null {
  const key = normalize(raw);
  if (!key || !TX_STATES.has(key as WalletTransactionState)) return null;
  return key as WalletTransactionState;
}

export function parseEconomyActionId(
  raw: string | null | undefined
): EconomyActionId | null {
  const key = normalize(raw);
  if (!key || !ACTIONS.has(key as EconomyActionId)) return null;
  return key as EconomyActionId;
}

export function parseWalletCapabilityId(
  raw: string | null | undefined
): WalletCapabilityId | null {
  const key = normalize(raw);
  if (!key || !CAPABILITIES.has(key as WalletCapabilityId)) return null;
  return key as WalletCapabilityId;
}
