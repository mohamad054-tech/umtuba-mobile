import type { SupabaseClient } from "@supabase/supabase-js";

import { getErrorMessage } from "@/src/contracts/validation";
import { isMessengerBackendMissing } from "@/src/lib/messenger/backend";
import type { ActionResult } from "@/src/lib/messenger/api";
import type { DiscoveredIdentity } from "@/src/lib/comms/privacyContract";

type PublicIdentityRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type ContactSyncRow = {
  permission_granted_at: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  revoked_at: string | null;
};

export type ContactSyncState = {
  permissionGrantedAt: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  revokedAt: string | null;
};

function mapIdentity(row: PublicIdentityRow): DiscoveredIdentity {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: (row.display_name ?? "").trim() || row.username,
    avatarUrl: row.avatar_url,
  };
}

function discoveryError(error: unknown): ActionResult<never> {
  const message = getErrorMessage(error, "Unable to look up this person.");
  const lower = message.toLowerCase();
  if (lower.includes("authentication required")) {
    return {
      ok: false,
      message: "Please sign in to start a conversation.",
      requiresAuth: true,
    };
  }
  if (
    isMessengerBackendMissing(message) ||
    lower.includes("could not find the function") ||
    lower.includes("schema cache") ||
    lower.includes("pgrst202")
  ) {
    return {
      ok: false,
      message:
        "Communications discovery is not set up on this project yet.",
      unavailable: true,
    };
  }
  return { ok: false, message };
}

async function discoverByRpc(
  supabase: SupabaseClient,
  fn: "discover_user_by_username" | "discover_user_by_email" | "discover_user_by_phone",
  args: Record<string, string>
): Promise<ActionResult<{ identity: DiscoveredIdentity | null }>> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    return discoveryError(error);
  }
  const row = Array.isArray(data) ? (data[0] as PublicIdentityRow | undefined) : null;
  if (!row?.user_id || !row.username) {
    return { ok: true, identity: null };
  }
  return { ok: true, identity: mapIdentity(row) };
}

export async function discoverUserByUsername(
  supabase: SupabaseClient,
  username: string
): Promise<ActionResult<{ identity: DiscoveredIdentity | null }>> {
  return discoverByRpc(supabase, "discover_user_by_username", {
    p_username: username,
  });
}

export async function discoverUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<ActionResult<{ identity: DiscoveredIdentity | null }>> {
  return discoverByRpc(supabase, "discover_user_by_email", { p_email: email });
}

export async function discoverUserByPhone(
  supabase: SupabaseClient,
  phoneE164: string
): Promise<ActionResult<{ identity: DiscoveredIdentity | null }>> {
  return discoverByRpc(supabase, "discover_user_by_phone", {
    p_phone: phoneE164,
  });
}

export async function getOwnContactSyncState(
  supabase: SupabaseClient
): Promise<ActionResult<{ state: ContactSyncState }>> {
  const { data, error } = await supabase.rpc("get_own_contact_sync_state");
  if (error) {
    return discoveryError(error);
  }
  const row = data as ContactSyncRow | null;
  return {
    ok: true,
    state: {
      permissionGrantedAt: row?.permission_granted_at ?? null,
      syncEnabled: Boolean(row?.sync_enabled),
      lastSyncAt: row?.last_sync_at ?? null,
      revokedAt: row?.revoked_at ?? null,
    },
  };
}

export async function setOwnContactSyncPermission(
  supabase: SupabaseClient,
  granted: boolean
): Promise<ActionResult<{ state: ContactSyncState }>> {
  const { data, error } = await supabase.rpc("set_own_contact_sync_permission", {
    p_granted: granted,
  });
  if (error) {
    return discoveryError(error);
  }
  const row = data as ContactSyncRow | null;
  return {
    ok: true,
    state: {
      permissionGrantedAt: row?.permission_granted_at ?? null,
      syncEnabled: Boolean(row?.sync_enabled),
      lastSyncAt: row?.last_sync_at ?? null,
      revokedAt: row?.revoked_at ?? null,
    },
  };
}
