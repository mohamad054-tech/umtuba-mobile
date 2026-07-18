import { z } from "zod";

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .min(1, "EXPO_PUBLIC_SUPABASE_URL is required")
    .url("EXPO_PUBLIC_SUPABASE_URL must be a valid URL"),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
  EXPO_PUBLIC_LIVEKIT_URL: z.string().trim().optional(),
});

export type AppEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  livekitUrl: string | null;
};

let cached: AppEnv | null = null;

function readRawEnv(): Record<string, string | undefined> {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_LIVEKIT_URL: process.env.EXPO_PUBLIC_LIVEKIT_URL,
  };
}

/**
 * Validate and return public client env.
 * Never reads a service-role key — mobile must use the publishable/anon key only.
 */
export function getEnv(): AppEnv {
  if (cached) {
    return cached;
  }

  const parsed = envSchema.safeParse(readRawEnv());

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid UMTUBA mobile env. Copy .env.example to .env and set Supabase values. ${details}`
    );
  }

  const key = parsed.data.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (/service[_-]?role/i.test(key) || key.includes("service_role")) {
    throw new Error(
      "Invalid UMTUBA mobile env. Do not use a Supabase service-role key in the app. Use the publishable/anon key only."
    );
  }

  const livekitRaw = parsed.data.EXPO_PUBLIC_LIVEKIT_URL?.trim() || "";
  if (livekitRaw) {
    try {
      // Validate shape without failing the whole env when unset.
      new URL(livekitRaw);
    } catch {
      throw new Error(
        "Invalid UMTUBA mobile env. EXPO_PUBLIC_LIVEKIT_URL must be a valid URL when set."
      );
    }
  }

  cached = {
    supabaseUrl: parsed.data.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: parsed.data.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    livekitUrl: livekitRaw || null,
  };

  return cached;
}

/** Test helper — clears memoized env. */
export function resetEnvCache(): void {
  cached = null;
}
