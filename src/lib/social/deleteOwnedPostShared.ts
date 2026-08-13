/**
 * Shared UAF-12 own-content delete contract (consumed from web, not a second backend).
 * Server/RLS remain the authorization source. UI hiding is not sufficient.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export const OWN_CONTENT_DELETE_ERRORS = {
  authRequired: "Please sign in to delete this.",
  notOwner: "You can only delete your own content.",
  notFound: "This content is no longer available.",
  deleteFailed: "Unable to delete this. Please try again.",
  invalid: "Invalid content.",
} as const;

export type DeleteOwnedPostCode =
  | "auth_required"
  | "not_owner"
  | "not_found"
  | "delete_failed"
  | "invalid";

export type DeleteOwnedPostResult =
  | { ok: true; postId: number; postType: string }
  | { ok: false; message: string; code: DeleteOwnedPostCode };

/** UI-only visibility. Server/RLS remain the authorization source. */
export function viewerMaySeeDeleteControl(
  viewerId: string | null | undefined,
  ownerUserId: string | null | undefined
): boolean {
  if (!isUuid(viewerId) || !isUuid(ownerUserId)) {
    return false;
  }
  return viewerId === ownerUserId;
}

export function applySuccessfulDeleteToList<T>(
  items: T[],
  shouldRemove: (item: T) => boolean,
  succeeded: boolean
): T[] {
  if (!succeeded) {
    return items;
  }
  return items.filter((item) => !shouldRemove(item));
}
