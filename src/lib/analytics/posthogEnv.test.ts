// Vitest-only Node imports. tsconfig excludes regressionLock the same way.
// @ts-nocheck
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}));

import { readPosthogPublicConfig } from "./posthogEnv";

const ROOT = join(process.cwd());

describe("PostHog public env", () => {
  it("reads EXPO_PUBLIC_POSTHOG_KEY as a source literal, not process.env[name]", () => {
    const envSrc = readFileSync(
      join(ROOT, "src/lib/analytics/posthogEnv.ts"),
      "utf8"
    );
    const configSrc = readFileSync(join(ROOT, "app.config.ts"), "utf8");
    expect(envSrc).toMatch(/process\.env\.EXPO_PUBLIC_POSTHOG_KEY/);
    expect(envSrc).toMatch(/process\.env\.EXPO_PUBLIC_POSTHOG_HOST/);
    expect(envSrc).not.toMatch(/process\.env\[/);
    expect(configSrc).toMatch(/process\.env\.EXPO_PUBLIC_POSTHOG_KEY/);
    expect(configSrc).toMatch(/process\.env\.EXPO_PUBLIC_POSTHOG_HOST/);
    expect(configSrc).not.toMatch(/process\.env\[/);
  });

  it("disables analytics when the key is missing or not a phc_ token", () => {
    vi.stubEnv("EXPO_PUBLIC_POSTHOG_KEY", "");
    vi.stubEnv("EXPO_PUBLIC_POSTHOG_HOST", "https://eu.i.posthog.com");
    const missing = readPosthogPublicConfig();
    expect(missing.enabled).toBe(false);
    expect(missing.keyPresentInBundle).toBe(false);

    vi.stubEnv("EXPO_PUBLIC_POSTHOG_KEY", "phc_testkeypresent1234");
    const present = readPosthogPublicConfig();
    expect(present.keyPresentInBundle).toBe(true);
    expect(present.enabled).toBe(true);
    expect(present.host).toBe("https://eu.i.posthog.com");
    vi.unstubAllEnvs();
  });
});
