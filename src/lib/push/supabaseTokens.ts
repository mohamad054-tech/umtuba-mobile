import type { SupabaseClient } from "@supabase/supabase-js";

import { PUSH_TOKENS_TABLE, type PushPlatform } from "@/src/lib/push/types";

export type PushTokenRow = {
  user_id: string;
  token: string;
  platform: PushPlatform;
  device_id: string | null;
  updated_at?: string;
};

/**
 * Persist an Expo push token for the authenticated user.
 * Uses the signed-in Supabase session (RLS) — never a service-role key.
 * Fails soft if the backend table is not provisioned yet.
 */
export async function upsertPushToken(
  client: SupabaseClient,
  row: PushTokenRow
): Promise<{ ok: true } | { ok: false; message: string; missingTable?: boolean }> {
  const { error } = await client.from(PUSH_TOKENS_TABLE).upsert(
    {
      user_id: row.user_id,
      token: row.token,
      platform: row.platform,
      device_id: row.device_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );

  if (error) {
    const message = error.message || "Unable to save push token.";
    const missingTable =
      /could not find the table|schema cache|does not exist|PGRST/i.test(
        message
      );
    return { ok: false, message, missingTable };
  }
  return { ok: true };
}

/**
 * Remove a push token for the authenticated user (logout / revoke).
 */
export async function deletePushToken(
  client: SupabaseClient,
  input: { userId: string; token: string }
): Promise<{ ok: true } | { ok: false; message: string; missingTable?: boolean }> {
  const { error } = await client
    .from(PUSH_TOKENS_TABLE)
    .delete()
    .eq("user_id", input.userId)
    .eq("token", input.token);

  if (error) {
    const message = error.message || "Unable to remove push token.";
    const missingTable =
      /could not find the table|schema cache|does not exist|PGRST/i.test(
        message
      );
    return { ok: false, message, missingTable };
  }
  return { ok: true };
}
