import type { SupabaseClient } from "@supabase/supabase-js";

import { mapNotificationUiCategory } from "@/src/lib/notifications/mapType";
import {
  isNotificationsBackendMissing,
  notificationErrorMessage,
  type AppNotification,
  type NotificationActor,
  type NotificationsActionResult,
} from "@/src/lib/notifications/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseActor(value: unknown): NotificationActor | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string") {
    return null;
  }

  return {
    id: row.id,
    username: typeof row.username === "string" ? row.username : null,
    displayName:
      typeof row.displayName === "string" && row.displayName.trim()
        ? row.displayName
        : typeof row.display_name === "string" && row.display_name.trim()
          ? row.display_name
          : "Someone",
    avatarInitial:
      typeof row.avatarInitial === "string" && row.avatarInitial.trim()
        ? row.avatarInitial
        : typeof row.avatar_initial === "string" && row.avatar_initial.trim()
          ? row.avatar_initial
          : "U",
  };
}

/**
 * Parse one RPC/table notification row.
 * Unknown types remain renderable (uiCategory = system/heuristic).
 */
export function parseAppNotification(value: unknown): AppNotification | null {
  const row = asRecord(value);
  if (!row || typeof row.id !== "string") {
    return null;
  }

  const type =
    typeof row.type === "string" && row.type.trim()
      ? row.type.trim()
      : "system";

  const createdAt =
    typeof row.createdAt === "string"
      ? row.createdAt
      : typeof row.created_at === "string"
        ? row.created_at
        : null;
  if (!createdAt) {
    return null;
  }

  const readAt =
    typeof row.readAt === "string"
      ? row.readAt
      : typeof row.read_at === "string"
        ? row.read_at
        : null;

  const title =
    typeof row.title === "string" && row.title.trim()
      ? row.title.trim()
      : "Notification";

  return {
    id: row.id,
    type,
    title,
    body: typeof row.body === "string" ? row.body : null,
    entityType:
      typeof row.entityType === "string"
        ? row.entityType
        : typeof row.entity_type === "string"
          ? row.entity_type
          : null,
    entityId:
      typeof row.entityId === "string"
        ? row.entityId
        : typeof row.entity_id === "string"
          ? row.entity_id
          : null,
    href: typeof row.href === "string" ? row.href : null,
    metadata: asRecord(row.metadata) ?? {},
    readAt,
    createdAt,
    actorId:
      typeof row.actorId === "string"
        ? row.actorId
        : typeof row.actor_id === "string"
          ? row.actor_id
          : null,
    actor: parseActor(row.actor),
    unread: !readAt,
    uiCategory: mapNotificationUiCategory(type),
  };
}

function failFromError(
  error: unknown,
  fallback: string
): NotificationsActionResult<never> {
  const message = notificationErrorMessage(error, fallback);
  return {
    ok: false,
    message,
    unavailable: isNotificationsBackendMissing(message),
  };
}

/**
 * List inbox notifications for the signed-in user via `list_my_notifications`.
 * Fail-closed / unavailable when the RPC is not provisioned.
 */
export async function listMyNotifications(
  client: SupabaseClient,
  input?: { limit?: number; before?: string | null }
): Promise<
  NotificationsActionResult<{
    notifications: AppNotification[];
    nextCursor: string | null;
  }>
> {
  const limit = Math.max(1, Math.min(input?.limit ?? 30, 50));
  const { data, error } = await client.rpc("list_my_notifications", {
    p_limit: limit,
    p_before: input?.before ?? null,
    p_category: "all",
  });

  if (error) {
    return failFromError(error, "Unable to load notifications.");
  }

  const rows = Array.isArray(data) ? data : [];
  const notifications = rows
    .map(parseAppNotification)
    .filter((n): n is AppNotification => Boolean(n));

  const nextCursor =
    notifications.length >= limit
      ? notifications[notifications.length - 1]?.createdAt ?? null
      : null;

  return { ok: true, notifications, nextCursor };
}

/**
 * Mark one notification read on the server when the RPC exists.
 */
export async function markMyNotificationRead(
  client: SupabaseClient,
  notificationId: string
): Promise<NotificationsActionResult<{ done: true }>> {
  if (!notificationId.trim()) {
    return { ok: false, message: "Missing notification id." };
  }

  const { error } = await client.rpc("mark_notification_read", {
    p_id: notificationId,
  });

  if (error) {
    return failFromError(error, "Unable to mark notification as read.");
  }

  return { ok: true, done: true };
}

/**
 * Apply unread → read for UI. Prefer server persistence; on unavailable RPC,
 * return local-only so the session can still update presentation.
 */
export async function resolveMarkNotificationRead(
  client: SupabaseClient,
  notificationId: string
): Promise<
  NotificationsActionResult<{ done: true; persistence: "server" | "local" }>
> {
  const result = await markMyNotificationRead(client, notificationId);
  if (result.ok) {
    return { ok: true, done: true, persistence: "server" };
  }
  if (result.unavailable) {
    return { ok: true, done: true, persistence: "local" };
  }
  return result;
}
