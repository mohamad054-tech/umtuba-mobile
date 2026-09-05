import { canOpenPrivateVisual } from "./privacy";
import type { VisualExpirationPolicy, VisualMessageRecord } from "./types";

export function isVisualMediaType(value: string): value is "image" | "video" {
  return value === "image" || value === "video";
}

export function defaultExpirationPolicy(): VisualExpirationPolicy {
  return "view_once";
}

export function markVisualOpened(
  record: VisualMessageRecord,
  viewerId: string,
  nowIso: string,
  blocked: boolean
): {
  record: VisualMessageRecord;
  opened: boolean;
  mediaRevoked: boolean;
  reason:
    | "opened"
    | "already_viewed"
    | "blocked"
    | "expired"
    | "not_participant"
    | "sender_preview";
} {
  const access = canOpenPrivateVisual({
    viewerId,
    senderId: record.senderId,
    recipientId: record.recipientId,
    blocked,
    viewed: record.viewed,
    expiresAt: record.expiresAt,
    nowIso,
  });

  if (!access.allowed) {
    return {
      record,
      opened: false,
      mediaRevoked: Boolean(record.viewed || access.reason === "expired"),
      reason:
        access.reason === "blocked" ||
        access.reason === "expired" ||
        access.reason === "not_participant"
          ? access.reason
          : "blocked",
    };
  }

  if (viewerId === record.senderId) {
    return {
      record,
      opened: false,
      mediaRevoked: false,
      reason: "sender_preview",
    };
  }

  if (record.viewed || record.openedAt) {
    return {
      record,
      opened: false,
      mediaRevoked: true,
      reason: "already_viewed",
    };
  }

  return {
    record: {
      ...record,
      viewed: true,
      openedAt: nowIso,
      expiresAt: nowIso,
    },
    opened: true,
    mediaRevoked: true,
    reason: "opened",
  };
}

export function visualMediaAccessible(
  record: VisualMessageRecord,
  nowIso: string
): boolean {
  if (record.viewed || record.openedAt) {
    return false;
  }
  if (record.expiresAt) {
    const expires = Date.parse(record.expiresAt);
    const now = Date.parse(nowIso);
    if (!Number.isNaN(expires) && !Number.isNaN(now) && now >= expires) {
      return false;
    }
  }
  return true;
}

/**
 * Server-authoritative view-once: a recipient who already opened must not
 * receive a fresh signed URL. Sender preview is allowed once per open call.
 */
export function shouldMintVisualSignedUrl(input: {
  visualOpenedAt: string | null | undefined;
  senderId: string;
  currentUserId: string;
}): boolean {
  if (input.visualOpenedAt && input.senderId !== input.currentUserId) {
    return false;
  }
  return true;
}

export function visualReplayBlocked(input: {
  viewed: boolean;
  isMine: boolean;
}): boolean {
  return input.viewed && !input.isMine;
}
