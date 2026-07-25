import type { SupabaseClient } from "@supabase/supabase-js";

import type { LiveLoadResult } from "@/src/lib/live/types";

/**
 * Whether a mobile Live lobby listing contract is provisioned.
 * Today: none — LiveKit URL alone is not a session list or join contract.
 */
export function isLiveLobbySourceConfigured(): boolean {
  return false;
}

/**
 * Load Live lobby sessions from a trusted mobile contract when one exists.
 * Fail-closed: does not call unknown RPCs/tables or invent sessions.
 */
export async function loadLiveLobby(
  _client?: SupabaseClient
): Promise<LiveLoadResult> {
  if (!isLiveLobbySourceConfigured()) {
    return {
      ok: false,
      unavailable: true,
      message:
        "Live lobby is not available yet. Session listing and joining will appear when a trusted mobile live contract is enabled.",
    };
  }

  // Reserved for a future trusted RPC — intentionally unreachable until configured.
  return {
    ok: false,
    unavailable: true,
    message: "Live lobby source is not available.",
  };
}
