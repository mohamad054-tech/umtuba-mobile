/**
 * Shared Watch UGC report/block contracts (iOS + Android).
 * No second backend. Server/RLS remain the authority for the
 * Desktop 20260928 UGC SQL RPCs bound by Central.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Closed set matching production 20260928 ugc_reports.reason_code. */
export const UGC_REPORT_REASONS = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "illegal",
  "impersonation",
  "other",
] as const;

export type UgcReportReason = (typeof UGC_REPORT_REASONS)[number];

export const UGC_REPORT_REASON_LABELS: Record<UgcReportReason, string> = {
  spam: "Spam or misleading",
  harassment: "Harassment or bullying",
  hate: "Hate or discrimination",
  sexual: "Sexual or pornographic content",
  violence: "Violence or dangerous acts",
  illegal: "Illegal activity",
  impersonation: "Impersonation or identity fraud",
  other: "Other objectionable content",
};

export const UGC_MODERATION_ERRORS = {
  authRequired: "Please sign in to report or block.",
  invalid: "Invalid content.",
  ownContent: "You cannot report or block your own account.",
  backendUnavailable:
    "Reporting to UMTUBA moderators is not available yet. The content can still be hidden on this device.",
  blockBackendUnavailable:
    "UMTUBA cannot store this block on the server yet. The account is hidden on this device only.",
  reportFailed: "Unable to submit this report. Please try again.",
  blockFailed: "Unable to block this account. Please try again.",
} as const;

export type UgcModerationCode =
  | "auth_required"
  | "invalid"
  | "own_content"
  | "backend_unavailable"
  | "report_failed"
  | "block_failed";

export type UgcReportResult =
  | {
      ok: true;
      postId?: number;
      userId?: string;
      reason: UgcReportReason;
      backendAccepted: boolean;
      hiddenLocally: boolean;
    }
  | { ok: false; message: string; code: UgcModerationCode };

export type UgcBlockResult =
  | {
      ok: true;
      userId: string;
      blocked: boolean;
      backendAccepted: boolean;
      localOnly: boolean;
    }
  | { ok: false; message: string; code: UgcModerationCode };

export type BlockedUserRecord = {
  userId: string;
  username: string | null;
  blockedAt: number;
};

/**
 * Production 20260928 UGC RPCs are applied. Mobile binds:
 * report_ugc_content, report_ugc_user, block_ugc_user, unblock_ugc_user,
 * list_my_blocked_users. Terms ack + account deletion reuse web contracts;
 * own-content delete reuses posts RLS (UAF-12).
 */
export function isUgcReportBackendConfigured(): boolean {
  return true;
}

export function isUgcBlockBackendConfigured(): boolean {
  return true;
}

export function isAllowedUgcReportReason(
  value: string | null | undefined
): value is UgcReportReason {
  return (
    typeof value === "string" &&
    (UGC_REPORT_REASONS as readonly string[]).includes(value)
  );
}

/** Report/block controls are for signed-in viewers looking at someone else's content. */
export function viewerMaySeeReportControl(
  viewerId: string | null | undefined,
  ownerUserId: string | null | undefined
): boolean {
  if (!isUuid(viewerId)) return false;
  if (!isUuid(ownerUserId)) return true;
  return viewerId !== ownerUserId;
}

export function viewerMaySeeBlockControl(
  viewerId: string | null | undefined,
  targetUserId: string | null | undefined
): boolean {
  if (!isUuid(viewerId) || !isUuid(targetUserId)) return false;
  return viewerId !== targetUserId;
}

export function filterWatchItemsForViewer<
  T extends {
    postId?: number | null;
    author?: { id?: string | null };
  },
>(
  items: T[],
  input: {
    blockedUserIds: ReadonlySet<string>;
    hiddenPostIds: ReadonlySet<number>;
  }
): T[] {
  return items.filter((item) => {
    const postId = item.postId;
    if (typeof postId === "number" && input.hiddenPostIds.has(postId)) {
      return false;
    }
    const authorId = item.author?.id;
    if (authorId && input.blockedUserIds.has(authorId)) {
      return false;
    }
    return true;
  });
}
