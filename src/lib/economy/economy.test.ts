import { describe, expect, it } from "vitest";

import {
  getEconomyFoundationSnapshot,
  isEconomyAdapterBound,
  isEconomyFoundationConfigured,
  isPaymentProviderBound,
  parseEconomyActionId,
  parseWalletBalance,
  parseWalletCurrency,
  parseWalletEntity,
  parseWalletReward,
  parseWalletTransaction,
  parseWalletTransactionState,
  parseWalletTransfer,
  requirePlatformEntityType,
  toWalletEntity,
} from "@/src/lib/economy";
import { parsePlatformEntity, parsePlatformEntityType } from "@/src/lib/platform";

describe("economy enums", () => {
  it("accepts known states/actions and rejects unknown", () => {
    expect(parseWalletTransactionState("completed")).toBe("completed");
    expect(parseWalletTransactionState("refunded")).toBe("refunded");
    expect(parseWalletTransactionState("settled")).toBeNull();
    expect(parseEconomyActionId("earn")).toBe("earn");
    expect(parseEconomyActionId("charge_card")).toBeNull();
  });
});

describe("platform economy entity types", () => {
  it("recognizes wallet/transaction/purchase/subscription and keeps reward distinct", () => {
    expect(parsePlatformEntityType("wallet")).toBe("wallet");
    expect(parsePlatformEntityType("transaction")).toBe("transaction");
    expect(parsePlatformEntityType("purchase")).toBe("purchase");
    expect(parsePlatformEntityType("subscription")).toBe("subscription");
    expect(parsePlatformEntityType("reward")).toBe("reward");
    expect(parsePlatformEntityType("stripe_charge")).toBeNull();
  });
});

describe("wallet entity mapping", () => {
  it("requires platform type wallet — reward cannot parse as wallet", () => {
    const asWallet = parseWalletEntity({
      id: "w1",
      type: "wallet",
      title: "UM Wallet",
      visibility: "private",
      ownership: "self",
      module: "rewards",
      wallet_id: "w1",
      currency_code: "UM",
    });
    expect(asWallet?.platformEntity.type).toBe("wallet");
    expect(asWallet?.walletId).toBe("w1");

    expect(
      parseWalletEntity({
        id: "r1",
        type: "reward",
        title: "Bonus",
        visibility: "private",
        ownership: "system",
        wallet_id: "w-fake",
      })
    ).toBeNull();

    const rewardEntity = parsePlatformEntity({
      id: "r1",
      type: "reward",
      title: "Referral bonus",
      visibility: "private",
      ownership: "system",
    });
    expect(rewardEntity?.type).toBe("reward");
    expect(toWalletEntity(rewardEntity!, { walletId: "w1" })).toBeNull();
    expect(requirePlatformEntityType(rewardEntity!, "reward")).not.toBeNull();
    expect(requirePlatformEntityType(rewardEntity!, "wallet")).toBeNull();
  });

  it("fails closed for unsupported economic platform types on wallet parse", () => {
    expect(
      parseWalletEntity({
        id: "t1",
        type: "transaction",
        title: "Tx",
        visibility: "private",
        ownership: "self",
        wallet_id: "w1",
      })
    ).toBeNull();
    expect(
      parseWalletEntity({
        id: "p1",
        type: "purchase",
        title: "Buy",
        visibility: "private",
        ownership: "self",
        wallet_id: "w1",
      })
    ).toBeNull();
    expect(
      parseWalletEntity({
        id: "s1",
        type: "subscription",
        title: "Sub",
        visibility: "private",
        ownership: "self",
        wallet_id: "w1",
      })
    ).toBeNull();
    expect(
      parseWalletEntity({
        id: "v1",
        type: "video",
        title: "Clip",
        visibility: "public",
        ownership: "self",
        wallet_id: "w1",
      })
    ).toBeNull();
  });

  it("keeps rewards as rewards and balances fail closed without amount", () => {
    expect(
      parseWalletReward({
        reward_id: "rw1",
        wallet_id: "w1",
        amount: 5,
        currency_code: "UM",
      })
    ).toMatchObject({ rewardId: "rw1", amount: 5 });

    expect(
      parseWalletBalance({
        wallet_id: "w1",
        currency_code: "UM",
        amount: 120,
      })
    ).toMatchObject({ amount: 120, currencyCode: "UM" });
    expect(
      parseWalletBalance({
        wallet_id: "w1",
        currency_code: "UM",
      })
    ).toBeNull();
    expect(
      parseWalletCurrency({ code: "UM", name: "UM Points", decimals: 0 })
    ).toMatchObject({ code: "UM", decimals: 0 });
  });

  it("parses transactions and transfers fail-closed", () => {
    expect(
      parseWalletTransaction({
        transaction_id: "t1",
        wallet_id: "w1",
        action: "earn",
        state: "completed",
        amount: 10,
        currency_code: "UM",
        destination: "/rewards",
      })
    ).toMatchObject({
      transactionId: "t1",
      action: "earn",
      state: "completed",
    });
    expect(
      parseWalletTransaction({
        transaction_id: "t2",
        wallet_id: "w1",
        action: "charge",
        state: "completed",
        amount: 1,
        currency_code: "UM",
      })
    ).toBeNull();
    expect(
      parseWalletTransfer({
        transfer_id: "tr1",
        from_wallet_id: "w1",
        to_wallet_id: "w2",
        amount: 5,
        currency_code: "UM",
        state: "pending",
      })
    ).toMatchObject({ transferId: "tr1", amount: 5 });
  });
});

describe("economy foundation / authority", () => {
  it("stays unavailable with no adapter and no parallel balance authority", () => {
    expect(isEconomyFoundationConfigured()).toBe(false);
    expect(isEconomyAdapterBound()).toBe(false);
    expect(isPaymentProviderBound()).toBe(false);
    const snap = getEconomyFoundationSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(snap.balances).toEqual([]);
    expect(snap.currencies).toEqual([]);
    expect(snap.capabilities.every((c) => c.enabled === false)).toBe(true);
    expect(snap.message).toMatch(/src\/lib\/wallet/i);
    expect(snap.message).toMatch(/bridge adapter|must not invent balances/i);
    expect(JSON.stringify(snap)).not.toMatch(
      /stripe|paypal|apple pay|google pay/i
    );
  });
});
