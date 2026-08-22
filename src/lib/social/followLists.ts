import type { SupabaseClient } from "@supabase/supabase-js";

import { parseProfileUserId } from "@/src/lib/profile/resolveTarget";

export const FOLLOW_LIST_PAGE_SIZE = 30;
export const FOLLOW_LIST_TABLE = "profile_follows" as const;

export type FollowListKind = "followers" | "following";

export type FollowListQueryPlan = {
  table: typeof FOLLOW_LIST_TABLE;
  /** Column that must equal the profile being viewed. */
  targetColumn: "following_id" | "follower_id";
  /** Column that identifies each listed account. */
  memberColumn: "follower_id" | "following_id";
};

export type FollowListMember = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarInitial: string;
  followedAt: string;
};

export type FollowListPage = {
  members: FollowListMember[];
  nextOffset: number | null;
  failed?: boolean;
};

export type FollowListCursor = {
  offset: number;
  limit?: number;
};

/**
 * FOLLOWERS: accounts that follow target_profile_user_id
 *   profile_follows.following_id = target, member = follower_id
 * FOLLOWING: accounts target_profile_user_id follows
 *   profile_follows.follower_id = target, member = following_id
 */
export function planFollowListQuery(
  kind: FollowListKind
): FollowListQueryPlan {
  if (kind === "followers") {
    return {
      table: FOLLOW_LIST_TABLE,
      targetColumn: "following_id",
      memberColumn: "follower_id",
    };
  }
  return {
    table: FOLLOW_LIST_TABLE,
    targetColumn: "follower_id",
    memberColumn: "following_id",
  };
}

/**
 * List owner must be an explicit profiles.id. Never fall back to the
 * signed-in account when the query id is missing or invalid.
 */
export function resolveFollowListTargetUserId(input: {
  queryUserId?: string | string[] | null;
  signedInUserId?: string | null;
}): string | null {
  void input.signedInUserId;
  return parseProfileUserId(input.queryUserId);
}

/** Profile screen: own vs other targeting without swapping to self. */
export function resolveFollowListOpenTarget(input: {
  isOwn: boolean;
  ownUserId?: string | null;
  otherUserId?: string | null;
}): string | null {
  if (input.isOwn) {
    return parseProfileUserId(input.ownUserId);
  }
  return parseProfileUserId(input.otherUserId);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" || url.protocol === "http:"
      ? trimmed
      : null;
  } catch {
    return null;
  }
}

function mapPublicProfile(
  row: Record<string, unknown>,
  followedAt: string
): FollowListMember | null {
  const userId = parseProfileUserId(
    typeof row.id === "string" ? row.id : null
  );
  const username = cleanText(row.username).replace(/^@/, "").toLowerCase();
  if (!userId || !username) return null;
  const displayName =
    cleanText(row.display_name) ||
    cleanText(row.full_name) ||
    username;
  const initial =
    cleanText(row.avatar_initial) ||
    displayName.charAt(0).toUpperCase() ||
    "U";
  return {
    userId,
    username,
    displayName,
    avatarUrl: cleanHttpUrl(row.avatar_url),
    avatarInitial: initial.slice(0, 1).toUpperCase(),
    followedAt,
  };
}

function uniqueUserIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

/**
 * Authoritative follow graph + one batched public-profile fetch.
 * RLS on profile_follows (select) and profiles still applies.
 */
export async function listFollowRelations(
  supabase: SupabaseClient,
  input: {
    targetUserId: string;
    kind: FollowListKind;
    cursor?: FollowListCursor | null;
  }
): Promise<FollowListPage> {
  const targetUserId = parseProfileUserId(input.targetUserId);
  if (!targetUserId) {
    return { members: [], nextOffset: null, failed: true };
  }

  const plan = planFollowListQuery(input.kind);
  const limit = Math.min(
    Math.max(input.cursor?.limit ?? FOLLOW_LIST_PAGE_SIZE, 1),
    FOLLOW_LIST_PAGE_SIZE
  );
  const offset = Math.max(input.cursor?.offset ?? 0, 0);

  const { data: followRows, error: followError } = await supabase
    .from(plan.table)
    .select(`${plan.memberColumn}, created_at`)
    .eq(plan.targetColumn, targetUserId)
    .order("created_at", { ascending: false })
    .order(plan.memberColumn, { ascending: false })
    .range(offset, offset + limit);

  if (followError) {
    return { members: [], nextOffset: null, failed: true };
  }

  const rawRows = Array.isArray(followRows) ? followRows : [];
  const hasMore = rawRows.length > limit;
  const pageRows = rawRows.slice(0, limit);

  const orderedIds: string[] = [];
  const followedAtById = new Map<string, string>();
  for (const raw of pageRows) {
    const row = asRecord(raw);
    if (!row) continue;
    const memberValue = row[plan.memberColumn];
    const userId = parseProfileUserId(
      typeof memberValue === "string" ? memberValue : null
    );
    if (!userId) continue;
    const key = userId.toLowerCase();
    if (followedAtById.has(key)) continue;
    followedAtById.set(
      key,
      typeof row.created_at === "string" ? row.created_at : ""
    );
    orderedIds.push(userId);
  }

  const ids = uniqueUserIds(orderedIds);
  if (ids.length === 0) {
    return { members: [], nextOffset: hasMore ? offset + limit : null };
  }

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, full_name, avatar_url, avatar_initial")
    .in("id", ids);

  if (profileError) {
    return { members: [], nextOffset: null, failed: true };
  }

  const profiles = new Map<string, Record<string, unknown>>();
  for (const raw of profileRows ?? []) {
    const row = asRecord(raw);
    const id = parseProfileUserId(
      typeof row?.id === "string" ? row.id : null
    );
    if (!row || !id) continue;
    profiles.set(id.toLowerCase(), row);
  }

  const members: FollowListMember[] = [];
  const seen = new Set<string>();
  for (const userId of ids) {
    const key = userId.toLowerCase();
    if (seen.has(key)) continue;
    const profile = profiles.get(key);
    if (!profile) continue;
    const member = mapPublicProfile(profile, followedAtById.get(key) ?? "");
    if (!member) continue;
    seen.add(key);
    members.push(member);
  }

  return {
    members,
    nextOffset: hasMore ? offset + limit : null,
  };
}
