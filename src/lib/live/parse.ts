import { mapLiveDestination } from "@/src/lib/live/mapDestination";
import { parseLiveSessionStatus } from "@/src/lib/live/status";
import type {
  LiveJoinDecision,
  LiveSession,
} from "@/src/lib/live/types";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanHttpUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return text;
  } catch {
    return null;
  }
}

function cleanIso(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return null;
  return text;
}

function cleanViewerCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.trunc(value);
}

/**
 * Parse a trusted backend row into a LiveSession.
 * Returns null when required identity/status fields are missing or unknown.
 */
export function parseLiveSession(row: unknown): LiveSession | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;

  const id = cleanText(r.id) ?? cleanText(r.session_id);
  if (!id) return null;

  const title = cleanText(r.title) ?? cleanText(r.name);
  if (!title) return null;

  const status = parseLiveSessionStatus(
    cleanText(r.status) ?? cleanText(r.state)
  );
  if (!status) return null;

  const destination =
    cleanText(r.destination) ??
    cleanText(r.href) ??
    cleanText(r.join_path) ??
    null;

  const explicitJoin =
    r.join_eligible === true ||
    r.joinEligible === true ||
    r.can_join === true;

  // Never invent eligibility — require explicit flag AND a mappable destination.
  const joinEligible =
    explicitJoin && mapLiveDestination(destination) != null;

  return {
    id,
    title,
    description: cleanText(r.description) ?? cleanText(r.body),
    hostDisplayName:
      cleanText(r.host_display_name) ??
      cleanText(r.hostDisplayName) ??
      cleanText(r.host_name) ??
      cleanText(r.hostName),
    thumbnailUrl: cleanHttpUrl(r.thumbnail_url) ?? cleanHttpUrl(r.thumbnailUrl),
    avatarUrl: cleanHttpUrl(r.avatar_url) ?? cleanHttpUrl(r.avatarUrl),
    startsAt: cleanIso(r.starts_at) ?? cleanIso(r.startsAt),
    endsAt: cleanIso(r.ends_at) ?? cleanIso(r.endsAt),
    status,
    viewerCount:
      cleanViewerCount(r.viewer_count) ?? cleanViewerCount(r.viewerCount),
    joinEligible,
    destination,
  };
}

export function parseLiveSessions(rows: unknown): LiveSession[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(parseLiveSession)
    .filter((s): s is LiveSession => Boolean(s));
}

/**
 * Whether a mobile-compatible join/token/stream contract is provisioned.
 * LiveKit URL env alone is not sufficient.
 */
export function isLiveJoinContractConfigured(): boolean {
  return false;
}

/**
 * Join is deferred until a mobile-compatible token/room contract exists.
 * Even trusted "live" rows cannot start a stream from this foundation alone.
 */
export function resolveLiveJoin(session: LiveSession): LiveJoinDecision {
  if (!isLiveJoinContractConfigured()) {
    return {
      canJoin: false,
      reason: "Live joining is not available yet.",
      href: null,
    };
  }

  if (session.status !== "live") {
    return {
      canJoin: false,
      reason:
        session.status === "scheduled"
          ? "This session has not started yet."
          : session.status === "ended"
            ? "This session has ended."
            : session.status === "cancelled"
              ? "This session was cancelled."
              : "This session is unavailable.",
      href: null,
    };
  }

  if (!session.joinEligible) {
    return {
      canJoin: false,
      reason: "Live joining is not available yet.",
      href: null,
    };
  }

  const href = mapLiveDestination(session.destination);
  if (!href) {
    return {
      canJoin: false,
      reason: "Live joining is not available yet.",
      href: null,
    };
  }

  return { canJoin: true, reason: null, href };
}
