import type {
  EconomyFoundationSnapshot,
  WalletCapability,
} from "@/src/lib/economy/types";
import type { PlatformPermission } from "@/src/lib/platform";

/**
 * Authority boundary (do not create a parallel balance authority here):
 * - Operational UM Points balances: `src/lib/wallet` + `src/contracts/wallet`
 * - Provider-agnostic economy contracts: this module
 * - Future adapters bridge operational wallet → economy; they do not fork truth
 */

export function listWalletCapabilities(): WalletCapability[] {
  return [
    { id: "view_balance", enabled: false },
    { id: "earn", enabled: false },
    { id: "spend", enabled: false },
    { id: "transfer", enabled: false },
    { id: "purchase", enabled: false },
    { id: "subscribe", enabled: false },
    { id: "refund", enabled: false },
    { id: "withdraw", enabled: false },
    { id: "games", enabled: false },
    { id: "learning", enabled: false },
    { id: "world", enabled: false },
    { id: "ads", enabled: false },
    { id: "store", enabled: false },
    { id: "creators", enabled: false },
    { id: "ai", enabled: false },
    { id: "notifications", enabled: false },
    { id: "messages", enabled: false },
    { id: "future", enabled: false },
  ];
}

export function defaultWalletPermissions(): PlatformPermission[] {
  return [
    { id: "view", granted: false },
    { id: "edit", granted: false },
    { id: "share", granted: false },
    { id: "admin", granted: false },
  ];
}

export function isEconomyFoundationConfigured(): boolean {
  return false;
}

/**
 * Fail-closed snapshot — no fake balances or currencies.
 * Does not read or replace the operational UM Points wallet.
 */
export function getEconomyFoundationSnapshot(): EconomyFoundationSnapshot {
  return {
    status: "unavailable",
    message:
      "Wallet & Economy foundation is available as contracts only. Operational UM Points remain in src/lib/wallet until a bridge adapter is bound. This layer must not invent balances or act as a second balance authority.",
    capabilities: listWalletCapabilities(),
    permissions: defaultWalletPermissions(),
    currencies: [],
    balances: [],
    visibilityDefault: "private",
  };
}
