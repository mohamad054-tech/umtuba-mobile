import { SUPPORT_LINKS } from "@/src/lib/settings/supportLinks";

export const UGC_REASON_CODES = [
  "spam",
  "harassment",
  "hate",
  "sexual",
  "violence",
  "illegal",
  "impersonation",
  "other",
] as const;

export type UgcReasonCode = (typeof UGC_REASON_CODES)[number];

export const UGC_REASON_LABELS: Record<UgcReasonCode, string> = {
  spam: "Spam or misleading",
  harassment: "Harassment or bullying",
  hate: "Hate or discrimination",
  sexual: "Sexual content or exploitation",
  violence: "Violence or threats",
  illegal: "Illegal activity",
  impersonation: "Impersonation",
  other: "Something else",
};

export const UGC_COMMUNITY_POLICY_URL = SUPPORT_LINKS.terms;
export const UGC_ACCOUNT_DELETION_URL = SUPPORT_LINKS.accountDeletion;

export const UGC_SIGNUP_TERMS_LABEL =
  "I agree to the UMTUBA Terms and community rules.";

export const MAX_REPORT_DETAIL_LENGTH = 1000;

export function isUgcReasonCode(value: string | null | undefined): value is UgcReasonCode {
  return (
    typeof value === "string" &&
    (UGC_REASON_CODES as readonly string[]).includes(value)
  );
}

export function canAcceptTerms(acknowledged: boolean): boolean {
  return acknowledged === true;
}

export function normalizeReportDetail(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REPORT_DETAIL_LENGTH);
}

export function validateReportInput(input: {
  reasonCode: string | null | undefined;
  detail?: string | null;
}): { ok: true; reasonCode: UgcReasonCode; detail: string | null } | { ok: false; message: string } {
  if (!isUgcReasonCode(input.reasonCode)) {
    return { ok: false, message: "Choose a reason for this report." };
  }
  const detail = normalizeReportDetail(input.detail);
  if (detail && detail.length > MAX_REPORT_DETAIL_LENGTH) {
    return { ok: false, message: "Report details are too long." };
  }
  return { ok: true, reasonCode: input.reasonCode, detail };
}

export function canReportOwnTarget(viewerId: string | null | undefined, targetUserId: string | null | undefined): boolean {
  if (!viewerId || !targetUserId) return true;
  return viewerId !== targetUserId;
}

export function canBlockUser(viewerId: string | null | undefined, targetUserId: string | null | undefined): boolean {
  if (!viewerId || !targetUserId) return false;
  return viewerId !== targetUserId;
}

export function shouldHideByBlock(
  actorId: string | null | undefined,
  blockedIds: ReadonlySet<string>
): boolean {
  if (!actorId) return false;
  return blockedIds.has(actorId);
}

export function filterVideosByBlockedAuthors<T extends { author: { id: string | null } }>(
  videos: T[],
  blockedIds: ReadonlySet<string>
): T[] {
  if (blockedIds.size === 0) return videos;
  return videos.filter((video) => !shouldHideByBlock(video.author.id, blockedIds));
}

export function filterConversationsByBlockedPeers<T extends { peerId: string }>(
  conversations: T[],
  blockedIds: ReadonlySet<string>
): T[] {
  if (blockedIds.size === 0) return conversations;
  return conversations.filter((conversation) => !blockedIds.has(conversation.peerId));
}

export function mapUgcRpcError(message: string | null | undefined, fallback: string): {
  ok: false;
  message: string;
  requiresAuth?: boolean;
  duplicate?: boolean;
} {
  const lower = (message || "").toLowerCase();
  if (lower.includes("authentication required")) {
    return { ok: false, message: "Please sign in to continue.", requiresAuth: true };
  }
  if (lower.includes("already reported")) {
    return {
      ok: false,
      message: "You already reported this. Thanks — we will review it.",
      duplicate: true,
    };
  }
  if (lower.includes("already blocked") || lower.includes("duplicate key")) {
    return { ok: false, message: "This account is already blocked." };
  }
  if (lower.includes("cannot report your own") || lower.includes("cannot report yourself")) {
    return { ok: false, message: "You cannot report your own account or content." };
  }
  if (lower.includes("cannot block yourself")) {
    return { ok: false, message: "You cannot block your own account." };
  }
  if (lower.includes("cannot message a blocked user")) {
    return {
      ok: false,
      message: "You cannot message this account because one of you blocked the other.",
    };
  }
  if (lower.includes("content not found") || lower.includes("user not found")) {
    return { ok: false, message: "That content or account is no longer available." };
  }
  if (lower.includes("too many reports")) {
    return { ok: false, message: "Too many reports in a short time. Try again later." };
  }
  if (lower.includes("invalid reason") || lower.includes("reason detail")) {
    return { ok: false, message: "Choose a valid report reason." };
  }
  return { ok: false, message: fallback };
}
