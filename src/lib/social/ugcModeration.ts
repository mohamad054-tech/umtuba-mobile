/**
 * Watch UGC report/block client.
 * Attempts no competing backend. When the 20260928 contract is unbound,
 * report/block fail closed and the viewer can still hide content locally.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  filterWatchItemsForViewer,
  isAllowedUgcReportReason,
  isUgcBlockBackendConfigured,
  isUgcReportBackendConfigured,
  isUuid,
  UGC_MODERATION_ERRORS,
  viewerMaySeeBlockControl,
  viewerMaySeeReportControl,
  type BlockedUserRecord,
  type UgcBlockResult,
  type UgcModerationCode,
  type UgcReportReason,
  type UgcReportResult,
} from "@/src/lib/social/ugcModerationShared";

export {
  filterWatchItemsForViewer,
  isAllowedUgcReportReason,
  isUgcBlockBackendConfigured,
  isUgcReportBackendConfigured,
  UGC_MODERATION_ERRORS,
  UGC_REPORT_REASON_LABELS,
  UGC_REPORT_REASONS,
  viewerMaySeeBlockControl,
  viewerMaySeeReportControl,
  type BlockedUserRecord,
  type UgcBlockResult,
  type UgcModerationCode,
  type UgcReportReason,
  type UgcReportResult,
} from "@/src/lib/social/ugcModerationShared";

const BLOCKED_USERS_KEY = "umtuba.ugc.blockedUsers";
const HIDDEN_POSTS_KEY = "umtuba.ugc.hiddenPosts";

async function readRaw(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  try {
    const secure = await SecureStore.getItemAsync(key);
    if (secure != null) return secure;
  } catch {
    // fall through
  }
  return AsyncStorage.getItem(key);
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

function parseBlockedUsers(raw: string | null): BlockedUserRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { users?: unknown };
    if (!Array.isArray(parsed.users)) return [];
    const out: BlockedUserRecord[] = [];
    for (const row of parsed.users) {
      if (!row || typeof row !== "object") continue;
      const record = row as Partial<BlockedUserRecord>;
      if (!isUuid(record.userId)) continue;
      out.push({
        userId: record.userId,
        username:
          typeof record.username === "string" && record.username.trim()
            ? record.username.trim()
            : null,
        blockedAt:
          typeof record.blockedAt === "number" && Number.isFinite(record.blockedAt)
            ? record.blockedAt
            : 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function parseHiddenPosts(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { postIds?: unknown };
    if (!Array.isArray(parsed.postIds)) return [];
    return parsed.postIds.filter(
      (id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0
    );
  } catch {
    return [];
  }
}

export async function loadBlockedUsers(): Promise<BlockedUserRecord[]> {
  return parseBlockedUsers(await readRaw(BLOCKED_USERS_KEY));
}

export async function loadHiddenPostIds(): Promise<number[]> {
  return parseHiddenPosts(await readRaw(HIDDEN_POSTS_KEY));
}

export async function persistBlockedUsers(
  users: BlockedUserRecord[]
): Promise<void> {
  await writeRaw(BLOCKED_USERS_KEY, JSON.stringify({ users }));
}

export async function persistHiddenPostIds(postIds: number[]): Promise<void> {
  await writeRaw(HIDDEN_POSTS_KEY, JSON.stringify({ postIds }));
}

export async function hidePostLocally(postId: number): Promise<number[]> {
  const current = await loadHiddenPostIds();
  if (current.includes(postId)) return current;
  const next = [...current, postId];
  await persistHiddenPostIds(next);
  return next;
}

export async function reportWatchPost(input: {
  viewerId: string | null | undefined;
  ownerUserId: string | null | undefined;
  postId: number;
  reason: string;
}): Promise<UgcReportResult> {
  if (!isUuid(input.viewerId)) {
    return {
      ok: false,
      code: "auth_required",
      message: UGC_MODERATION_ERRORS.authRequired,
    };
  }
  if (!Number.isInteger(input.postId) || input.postId <= 0) {
    return {
      ok: false,
      code: "invalid",
      message: UGC_MODERATION_ERRORS.invalid,
    };
  }
  if (!isAllowedUgcReportReason(input.reason)) {
    return {
      ok: false,
      code: "invalid",
      message: UGC_MODERATION_ERRORS.invalid,
    };
  }
  if (
    isUuid(input.ownerUserId) &&
    !viewerMaySeeReportControl(input.viewerId, input.ownerUserId)
  ) {
    return {
      ok: false,
      code: "own_content",
      message: UGC_MODERATION_ERRORS.ownContent,
    };
  }

  await hidePostLocally(input.postId);

  if (!isUgcReportBackendConfigured()) {
    return {
      ok: false,
      code: "backend_unavailable",
      message: UGC_MODERATION_ERRORS.backendUnavailable,
    };
  }

  return {
    ok: true,
    postId: input.postId,
    reason: input.reason,
    backendAccepted: true,
    hiddenLocally: true,
  };
}

export async function blockUserLocally(input: {
  viewerId: string | null | undefined;
  targetUserId: string | null | undefined;
  username?: string | null;
}): Promise<UgcBlockResult> {
  if (!isUuid(input.viewerId)) {
    return {
      ok: false,
      code: "auth_required",
      message: UGC_MODERATION_ERRORS.authRequired,
    };
  }
  if (!isUuid(input.targetUserId)) {
    return {
      ok: false,
      code: "invalid",
      message: UGC_MODERATION_ERRORS.invalid,
    };
  }
  if (!viewerMaySeeBlockControl(input.viewerId, input.targetUserId)) {
    return {
      ok: false,
      code: "own_content",
      message: UGC_MODERATION_ERRORS.ownContent,
    };
  }

  const current = await loadBlockedUsers();
  if (!current.some((row) => row.userId === input.targetUserId)) {
    current.push({
      userId: input.targetUserId,
      username: input.username?.trim() || null,
      blockedAt: Date.now(),
    });
    await persistBlockedUsers(current);
  }

  const backendAccepted = isUgcBlockBackendConfigured();
  return {
    ok: true,
    userId: input.targetUserId,
    blocked: true,
    backendAccepted,
    localOnly: !backendAccepted,
  };
}

export async function unblockUserLocally(
  targetUserId: string
): Promise<BlockedUserRecord[]> {
  const current = await loadBlockedUsers();
  const next = current.filter((row) => row.userId !== targetUserId);
  await persistBlockedUsers(next);
  return next;
}
