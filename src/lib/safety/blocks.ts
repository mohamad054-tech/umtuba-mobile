import type { SupabaseClient } from "@supabase/supabase-js";

import { canBlockUser, mapUgcRpcError } from "@/src/lib/safety/ugcPolicy";
import type { SafetyActionResult } from "@/src/lib/safety/reports";

export type BlockedUser = {
  userId: string;
  username: string | null;
  displayName: string | null;
  createdAt: string;
};

export async function listUgcBlockIds(
  supabase: SupabaseClient
): Promise<SafetyActionResult<{ ids: string[] }>> {
  const { data, error } = await supabase.rpc("list_ugc_block_ids");
  if (error) {
    return mapUgcRpcError(error.message, "Unable to load blocked accounts.");
  }
  const ids = Array.isArray(data)
    ? data.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];
  return { ok: true, ids };
}

export async function listMyBlockedUsers(
  supabase: SupabaseClient
): Promise<SafetyActionResult<{ users: BlockedUser[] }>> {
  const { data, error } = await supabase.rpc("list_my_blocked_users");
  if (error) {
    return mapUgcRpcError(error.message, "Unable to load blocked accounts.");
  }

  const users: BlockedUser[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    if (!userId) continue;
    users.push({
      userId,
      username: typeof row.username === "string" ? row.username : null,
      displayName: typeof row.display_name === "string" ? row.display_name : null,
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
    });
  }
  return { ok: true, users };
}

export async function blockUgcUser(
  supabase: SupabaseClient,
  viewerId: string | null | undefined,
  userId: string
): Promise<SafetyActionResult<{ blockId: string }>> {
  const target = userId.trim();
  if (!canBlockUser(viewerId, target)) {
    return { ok: false, message: "You cannot block this account." };
  }

  const { data, error } = await supabase.rpc("block_ugc_user", {
    p_user_id: target,
  });

  if (error) {
    return mapUgcRpcError(error.message, "Unable to block this account. Please try again.");
  }

  const blockId = typeof data === "string" ? data : data != null ? String(data) : "";
  if (!blockId) {
    return { ok: false, message: "Unable to block this account. Please try again." };
  }
  return { ok: true, blockId };
}

export async function unblockUgcUser(
  supabase: SupabaseClient,
  userId: string
): Promise<SafetyActionResult<{ unblocked: boolean }>> {
  const target = userId.trim();
  if (!target) {
    return { ok: false, message: "That account cannot be unblocked." };
  }

  const { data, error } = await supabase.rpc("unblock_ugc_user", {
    p_user_id: target,
  });

  if (error) {
    return mapUgcRpcError(
      error.message,
      "Unable to unblock this account. Please try again."
    );
  }

  return { ok: true, unblocked: data === true };
}

export function toBlockedIdSet(ids: string[] | null | undefined): Set<string> {
  return new Set((ids ?? []).filter((id) => id.length > 0));
}
