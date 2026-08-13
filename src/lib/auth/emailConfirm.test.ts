import { describe, expect, it, vi } from "vitest";

import {
  emailConfirmFailureMessage,
  establishEmailConfirmSession,
  isEmailConfirmCallbackUrl,
} from "./emailConfirm";
import { isRecoveryCallbackUrl } from "./passwordRecovery";
import type { RecoveryAuthClient } from "./passwordRecovery";

function mockClient(
  overrides: Partial<RecoveryAuthClient["auth"]> = {}
): RecoveryAuthClient {
  return {
    auth: {
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ data: {}, error: null })),
      ...overrides,
    },
  };
}

describe("isEmailConfirmCallbackUrl", () => {
  it("detects signup hash tokens and PKCE callback path", () => {
    expect(
      isEmailConfirmCallbackUrl(
        "umtuba://auth/callback#access_token=a&refresh_token=b&type=signup"
      )
    ).toBe(true);
    expect(
      isEmailConfirmCallbackUrl("umtuba://auth/callback?code=pkce-confirm")
    ).toBe(true);
    expect(isEmailConfirmCallbackUrl("umtuba://watch")).toBe(false);
  });

  it("does not steal password-recovery links", () => {
    const recovery =
      "umtuba://auth/update-password#access_token=a&refresh_token=b&type=recovery";
    expect(isRecoveryCallbackUrl(recovery)).toBe(true);
    expect(isEmailConfirmCallbackUrl(recovery)).toBe(false);
    expect(
      isRecoveryCallbackUrl("umtuba://auth/callback?code=pkce-confirm")
    ).toBe(false);
  });
});

describe("establishEmailConfirmSession", () => {
  it("exchanges a PKCE code for a session", async () => {
    const client = mockClient();
    const result = await establishEmailConfirmSession(client, {
      kind: "code",
      code: "pkce-confirm",
    });
    expect(result).toEqual({ ok: true, type: "signup" });
    expect(client.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "pkce-confirm"
    );
  });

  it("maps expired confirm links", async () => {
    const client = mockClient({
      exchangeCodeForSession: vi.fn(async () => ({
        data: {},
        error: { message: "otp_expired: Token has expired" },
      })),
    });
    const result = await establishEmailConfirmSession(client, {
      kind: "code",
      code: "stale",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(emailConfirmFailureMessage());
    }
  });
});
