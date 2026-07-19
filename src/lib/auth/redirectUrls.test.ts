import { describe, expect, it, vi } from "vitest";

vi.mock("expo-linking", () => ({
  createURL: (path: string, opts?: { scheme?: string }) =>
    `${opts?.scheme ?? "app"}://${path}`,
}));

import {
  APP_SCHEME,
  AUTH_UPDATE_PASSWORD_PATH,
  SUPABASE_AUTH_REDIRECT_ALLOWLIST,
  createAuthRedirectUrl,
} from "./redirectUrls";

describe("auth redirect URLs", () => {
  it("exposes the app scheme and update-password path", () => {
    expect(APP_SCHEME).toBe("umtuba");
    expect(AUTH_UPDATE_PASSWORD_PATH).toBe("auth/update-password");
  });

  it("lists public Supabase allowlist patterns without secrets", () => {
    expect(SUPABASE_AUTH_REDIRECT_ALLOWLIST).toContain(
      "umtuba://auth/update-password"
    );
    expect(SUPABASE_AUTH_REDIRECT_ALLOWLIST).toContain("umtuba://**");
    expect(
      SUPABASE_AUTH_REDIRECT_ALLOWLIST.every(
        (entry) => !/service[_-]?role|secret|key=/i.test(entry)
      )
    ).toBe(true);
  });

  it("builds a scheme-forced redirect URL", () => {
    expect(createAuthRedirectUrl()).toBe("umtuba://auth/update-password");
    expect(createAuthRedirectUrl("/auth/update-password")).toBe(
      "umtuba://auth/update-password"
    );
  });
});
