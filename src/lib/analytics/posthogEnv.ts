const DEFAULT_EU_HOST = "https://eu.i.posthog.com";

export type PosthogPublicConfig = {
  key: string;
  host: string;
  enabled: boolean;
  keyPresentInBundle: boolean;
};

function extraString(name: "posthogKey" | "posthogHost"): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require("expo-constants") as {
      default?: { expoConfig?: { extra?: Record<string, unknown> } };
      expoConfig?: { extra?: Record<string, unknown> };
    };
    const extra =
      Constants.default?.expoConfig?.extra ?? Constants.expoConfig?.extra;
    const value = extra?.[name];
    return typeof value === "string" ? value.trim() : "";
  } catch {
    return "";
  }
}

function trimEnv(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readPosthogPublicConfig(): PosthogPublicConfig {
  // Literal identifiers only — Metro/EAS inline these. Never a dynamic env name.
  const key =
    trimEnv(process.env.EXPO_PUBLIC_POSTHOG_KEY) || extraString("posthogKey");
  const host =
    trimEnv(process.env.EXPO_PUBLIC_POSTHOG_HOST) ||
    extraString("posthogHost") ||
    DEFAULT_EU_HOST;
  const keyPresentInBundle = key.startsWith("phc_") && key.length > 12;
  const hostOk = host.startsWith("https://");
  return {
    key,
    host,
    enabled: keyPresentInBundle && hostOk,
    keyPresentInBundle,
  };
}
