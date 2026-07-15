import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv, resetEnvCache } from "@/src/lib/env";

describe("getEnv", () => {
  afterEach(() => {
    resetEnvCache();
    vi.unstubAllEnvs();
  });

  it("accepts required public Supabase vars", () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("EXPO_PUBLIC_LIVEKIT_URL", "");

    const env = getEnv();
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.supabasePublishableKey).toBe("sb_publishable_test");
    expect(env.livekitUrl).toBeNull();
  });

  it("rejects missing publishable key", () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getEnv()).toThrow(/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it("does not require service-role variables", () => {
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    // Presence of a service-role env must never be part of mobile validation.
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "should-be-ignored");

    const env = getEnv();
    expect(env.supabasePublishableKey).toBe("sb_publishable_test");
    expect(
      Object.prototype.hasOwnProperty.call(env, "serviceRoleKey")
    ).toBe(false);
  });
});
