import { describe, expect, it, vi } from "vitest";

import {
  classifyRecoveryAuthError,
  establishRecoverySession,
  isRecoveryCallbackUrl,
  parseRecoveryAuthUrl,
  recoveryFailureMessage,
  updatePasswordWithSession,
  validatePasswordUpdate,
  type RecoveryAuthClient,
} from "./passwordRecovery";

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

describe("parseRecoveryAuthUrl", () => {
  it("parses umtuba hash recovery tokens", () => {
    const parsed = parseRecoveryAuthUrl(
      "umtuba://auth/update-password#access_token=atk&refresh_token=rtk&type=recovery"
    );
    expect(parsed).toEqual({
      kind: "tokens",
      accessToken: "atk",
      refreshToken: "rtk",
      type: "recovery",
    });
  });

  it("parses https and Expo development recovery links", () => {
    expect(
      parseRecoveryAuthUrl(
        "https://umtuba.com/auth/update-password#access_token=a&refresh_token=b&type=recovery"
      ).kind
    ).toBe("tokens");
    expect(
      parseRecoveryAuthUrl(
        "exp://127.0.0.1:8081/--/auth/update-password#access_token=a&refresh_token=b&type=recovery"
      )
    ).toMatchObject({ kind: "tokens", type: "recovery" });
  });

  it("parses PKCE code query params", () => {
    expect(
      parseRecoveryAuthUrl(
        "umtuba://auth/update-password?code=pkce-code-1"
      )
    ).toEqual({ kind: "code", code: "pkce-code-1" });
  });

  it("returns none when tokens are absent", () => {
    expect(parseRecoveryAuthUrl("umtuba://auth/update-password")).toEqual({
      kind: "none",
    });
  });
});

describe("isRecoveryCallbackUrl", () => {
  it("detects recovery callback URLs", () => {
    expect(
      isRecoveryCallbackUrl(
        "umtuba://auth/update-password#access_token=a&refresh_token=b&type=recovery"
      )
    ).toBe(true);
    expect(
      isRecoveryCallbackUrl("umtuba://auth/update-password?code=abc")
    ).toBe(true);
    expect(isRecoveryCallbackUrl("umtuba://watch")).toBe(false);
  });
});

describe("establishRecoverySession", () => {
  it("establishes a session from recovery tokens", async () => {
    const client = mockClient();
    const result = await establishRecoverySession(client, {
      kind: "tokens",
      accessToken: "atk",
      refreshToken: "rtk",
      type: "recovery",
    });
    expect(result).toEqual({ ok: true, type: "recovery" });
    expect(client.auth.setSession).toHaveBeenCalledWith({
      access_token: "atk",
      refresh_token: "rtk",
    });
  });

  it("maps invalid token errors", async () => {
    const client = mockClient({
      setSession: vi.fn(async () => ({
        data: {},
        error: { message: "Invalid JWT" },
      })),
    });
    const result = await establishRecoverySession(client, {
      kind: "tokens",
      accessToken: "bad",
      refreshToken: "bad",
      type: "recovery",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_token");
      expect(result.message).toBe(recoveryFailureMessage("invalid_token"));
    }
  });

  it("maps expired recovery session errors", async () => {
    const client = mockClient({
      exchangeCodeForSession: vi.fn(async () => ({
        data: {},
        error: { message: "otp_expired: Token has expired" },
      })),
    });
    const result = await establishRecoverySession(client, {
      kind: "code",
      code: "stale",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
      expect(result.message).toBe(recoveryFailureMessage("expired"));
    }
  });
});

describe("updatePasswordWithSession", () => {
  it("rejects mismatched confirmation", async () => {
    const client = mockClient();
    const result = await updatePasswordWithSession(
      client,
      "secret1",
      "secret2"
    );
    expect(result).toEqual({
      ok: false,
      message: "Passwords do not match.",
    });
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates password on successful reset", async () => {
    const client = mockClient();
    const result = await updatePasswordWithSession(
      client,
      "secret12",
      "secret12"
    );
    expect(result).toEqual({ ok: true });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: "secret12",
    });
  });

  it("surfaces expired recovery session on update", async () => {
    const client = mockClient({
      updateUser: vi.fn(async () => ({
        data: {},
        error: { message: "Auth session missing or expired" },
      })),
    });
    const result = await updatePasswordWithSession(
      client,
      "secret12",
      "secret12"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/expired|invalid/i);
    }
  });
});

describe("validatePasswordUpdate / classifyRecoveryAuthError", () => {
  it("enforces minimum password rules", () => {
    expect(validatePasswordUpdate("123", "123")).toMatch(/6/);
    expect(validatePasswordUpdate("123456", "123456")).toBeNull();
  });

  it("classifies invalid and expired auth errors", () => {
    expect(classifyRecoveryAuthError({ message: "Invalid Refresh Token" })).toBe(
      "invalid_token"
    );
    expect(classifyRecoveryAuthError({ message: "token has expired" })).toBe(
      "expired"
    );
  });
});
