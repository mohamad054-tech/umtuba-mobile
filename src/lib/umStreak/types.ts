/**
 * UM Streak + private visual message domain.
 * Authoritative streak math lives here so clients cannot invent days.
 * Ported from web candidate SHA 28a4c2a6 — do not award days on the client.
 */

export const UM_STREAK_TIMEZONE_POLICY = "utc_calendar_day" as const;

/** Authoritative streak day is the UTC calendar date of the event. */
export type UmStreakTimezonePolicy = typeof UM_STREAK_TIMEZONE_POLICY;

export const UM_STREAK_MEDIA_TYPES = ["image", "video"] as const;
export type UmStreakMediaType = (typeof UM_STREAK_MEDIA_TYPES)[number];

export const UM_STREAK_STATES = [
  "none",
  "started",
  "active_today",
  "waiting_for_friend",
  "you_need_to_reply",
  "at_risk",
  "broken",
] as const;
export type UmStreakState = (typeof UM_STREAK_STATES)[number];

export const UM_STREAK_BADGE_DAYS = [3, 7, 30, 100, 365] as const;
export type UmStreakBadgeDay = (typeof UM_STREAK_BADGE_DAYS)[number];

export const VISUAL_EXPIRATION_POLICIES = [
  "view_once",
  "disappear_after_view",
] as const;
export type VisualExpirationPolicy = (typeof VISUAL_EXPIRATION_POLICIES)[number];

export type UmStreakPair = {
  userLowId: string;
  userHighId: string;
  pairKey: string;
};

export type UmStreakRecord = {
  pairKey: string;
  userLowId: string;
  userHighId: string;
  currentStreak: number;
  longestStreak: number;
  lastQualifyingDayLow: string | null;
  lastQualifyingDayHigh: string | null;
  lastCompletedStreakDay: string | null;
  streakState: UmStreakState;
  createdAt: string;
  updatedAt: string;
};

export type QualifyingVisualEvent = {
  eventId: string;
  senderId: string;
  recipientId: string;
  occurredAt: string;
  mediaType: UmStreakMediaType;
  blocked: boolean;
};

export type ApplyStreakResult = {
  record: UmStreakRecord;
  accepted: boolean;
  incremented: boolean;
  reason:
    | "applied"
    | "duplicate_event"
    | "duplicate_same_day"
    | "one_sided"
    | "blocked"
    | "invalid";
};

export type VisualMessageRecord = {
  id: string;
  senderId: string;
  recipientId: string;
  conversationId: string;
  mediaRef: string;
  mediaType: UmStreakMediaType;
  createdAt: string;
  openedAt: string | null;
  expiresAt: string | null;
  expirationPolicy: VisualExpirationPolicy;
  caption: string | null;
  viewed: boolean;
};

export type UmStreakBadge = {
  days: UmStreakBadgeDay;
  earned: boolean;
  earnedAt: string | null;
};

export type UmStreakViewerStatus = {
  state: UmStreakState;
  currentStreak: number;
  longestStreak: number;
  badges: UmStreakBadge[];
};

export type VisualMessageView = {
  mediaType: UmStreakMediaType;
  caption: string | null;
  viewed: boolean;
  openedAt: string | null;
  expirationPolicy: VisualExpirationPolicy;
  previewUrl?: string | null;
};
