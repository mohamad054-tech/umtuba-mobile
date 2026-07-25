import { getErrorMessage } from "@/src/contracts/validation";

/** UI buckets for rendering — expandable without changing storage. */
export type NotificationUiCategory =
  | "social"
  | "messages"
  | "watch"
  | "learning"
  | "games"
  | "system";

export type NotificationActor = {
  id: string;
  username: string | null;
  displayName: string;
  avatarInitial: string;
};

export type AppNotification = {
  id: string;
  /** Raw backend type string (known or future). */
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  /** Original web/mobile href metadata from the server. */
  href: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actorId: string | null;
  actor: NotificationActor | null;
  unread: boolean;
  uiCategory: NotificationUiCategory;
};

export type NotificationsActionResult<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      message: string;
      /** True when notifications RPCs/table are not provisioned yet. */
      unavailable?: boolean;
      requiresAuth?: boolean;
    };

export function notificationErrorMessage(
  error: unknown,
  fallback: string
): string {
  return getErrorMessage(error, fallback);
}

export function isNotificationsBackendMissing(message: string): boolean {
  return /could not find the (table|function)|schema cache|does not exist|PGRST202|PGRST205|404/i.test(
    message
  );
}
