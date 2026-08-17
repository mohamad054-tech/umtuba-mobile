import { describe, expect, it, vi } from "vitest";

import {
  claimVerifiedWelcomeBonus,
  loadWalletAfterWelcomeClaim,
} from "./claimWelcomeBonus";

describe("claimVerifiedWelcomeBonus", () => {
  it("calls the authenticated welcome RPC and does not invent 100 points", async () => {
    const rpc = vi.fn(async () => ({
      data: { created: true, reason: "verified_welcome" },
      error: null,
    }));
    const result = await claimVerifiedWelcomeBonus({ rpc } as never);
    expect(rpc).toHaveBeenCalledWith("claim_verified_welcome_bonus");
    expect(result).toEqual({ created: true, reason: "verified_welcome" });
  });

  it("treats a second claim as a server-side no-op", async () => {
    const rpc = vi.fn(async () => ({
      data: { created: false, reason: "already_awarded" },
      error: null,
    }));
    const result = await claimVerifiedWelcomeBonus({ rpc } as never);
    expect(result.created).toBe(false);
    expect(result.reason).toBe("already_awarded");
  });

  it("does not synthesize a grant when the RPC fails", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "Authentication required" },
    }));
    const result = await claimVerifiedWelcomeBonus({ rpc } as never);
    expect(result).toEqual({
      created: false,
      reason: "Authentication required",
    });
  });
});

describe("loadWalletAfterWelcomeClaim", () => {
  it("refreshes the authoritative balance after the claim", async () => {
    const rpc = vi.fn(async () => ({
      data: { created: true },
      error: null,
    }));
    const maybeSingle = vi.fn(async () => ({
      data: { balance: 100, updated_at: "2026-08-17T00:00:00Z" },
      error: null,
    }));
    const supabase = {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    };
    const wallet = await loadWalletAfterWelcomeClaim(
      supabase as never,
      "11111111-1111-4111-8111-111111111111"
    );
    expect(rpc).toHaveBeenCalledWith("claim_verified_welcome_bonus");
    expect(wallet.amount).toBe(100);
    expect(wallet.assetId).toBe("um_points");
  });
});
