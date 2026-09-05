import { badgesFromLongest } from "./badges";
import { previousUtcDay, utcDayKey } from "./calendar";
import { canonicalPair } from "./privacy";
import type {
  ApplyStreakResult,
  QualifyingVisualEvent,
  UmStreakRecord,
  UmStreakState,
  UmStreakViewerStatus,
} from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function emptyStreakRecord(
  userA: string,
  userB: string,
  nowIso: string
): UmStreakRecord | null {
  const pair = canonicalPair(userA, userB);
  if (!pair) {
    return null;
  }

  return {
    pairKey: pair.pairKey,
    userLowId: pair.userLowId,
    userHighId: pair.userHighId,
    currentStreak: 0,
    longestStreak: 0,
    lastQualifyingDayLow: null,
    lastQualifyingDayHigh: null,
    lastCompletedStreakDay: null,
    streakState: "none",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function applyQualifyingVisualEvent(input: {
  record: UmStreakRecord;
  event: QualifyingVisualEvent;
  seenEventIds?: ReadonlySet<string>;
}): ApplyStreakResult {
  const { record, event } = input;
  const pair = canonicalPair(event.senderId, event.recipientId);

  if (
    !pair ||
    pair.pairKey !== record.pairKey ||
    !UUID_RE.test(event.eventId) ||
    (event.mediaType !== "image" && event.mediaType !== "video")
  ) {
    return {
      record,
      accepted: false,
      incremented: false,
      reason: "invalid",
    };
  }

  if (event.blocked) {
    return {
      record,
      accepted: false,
      incremented: false,
      reason: "blocked",
    };
  }

  if (input.seenEventIds?.has(event.eventId)) {
    return {
      record,
      accepted: false,
      incremented: false,
      reason: "duplicate_event",
    };
  }

  let today: string;
  try {
    today = utcDayKey(event.occurredAt);
  } catch {
    return {
      record,
      accepted: false,
      incremented: false,
      reason: "invalid",
    };
  }

  const senderIsLow = event.senderId === record.userLowId;
  const senderDay = senderIsLow
    ? record.lastQualifyingDayLow
    : record.lastQualifyingDayHigh;

  if (senderDay === today) {
    return {
      record: resolveStreakState(
        { ...record, updatedAt: event.occurredAt },
        today
      ),
      accepted: true,
      incremented: false,
      reason: "duplicate_same_day",
    };
  }

  const next: UmStreakRecord = {
    ...record,
    lastQualifyingDayLow: senderIsLow ? today : record.lastQualifyingDayLow,
    lastQualifyingDayHigh: senderIsLow ? record.lastQualifyingDayHigh : today,
    updatedAt: event.occurredAt,
  };

  const bothQualifiedToday =
    next.lastQualifyingDayLow === today && next.lastQualifyingDayHigh === today;

  if (!bothQualifiedToday) {
    return {
      record: resolveStreakState(next, today),
      accepted: true,
      incremented: false,
      reason: "one_sided",
    };
  }

  if (next.lastCompletedStreakDay === today) {
    return {
      record: resolveStreakState(next, today),
      accepted: true,
      incremented: false,
      reason: "duplicate_same_day",
    };
  }

  const yesterday = previousUtcDay(today);
  const continued = next.lastCompletedStreakDay === yesterday;
  const nextCurrent = continued ? next.currentStreak + 1 : 1;
  const nextLongest = Math.max(next.longestStreak, nextCurrent);

  return {
    record: resolveStreakState(
      {
        ...next,
        currentStreak: nextCurrent,
        longestStreak: nextLongest,
        lastCompletedStreakDay: today,
      },
      today
    ),
    accepted: true,
    incremented: true,
    reason: "applied",
  };
}

export function resolveStreakState(
  record: UmStreakRecord,
  today: string
): UmStreakRecord {
  const expired = isStreakExpired(record, today);
  const currentStreak = expired ? 0 : record.currentStreak;
  const lastCompleted = expired ? null : record.lastCompletedStreakDay;
  const lastLow =
    expired && record.lastQualifyingDayLow !== today
      ? null
      : record.lastQualifyingDayLow;
  const lastHigh =
    expired && record.lastQualifyingDayHigh !== today
      ? null
      : record.lastQualifyingDayHigh;

  const normalized: UmStreakRecord = {
    ...record,
    currentStreak,
    lastCompletedStreakDay: lastCompleted,
    lastQualifyingDayLow: lastLow,
    lastQualifyingDayHigh: lastHigh,
    streakState: "none",
  };

  return {
    ...normalized,
    streakState: derivePairState(normalized, today),
  };
}

export function derivePairState(
  record: UmStreakRecord,
  today: string
): UmStreakState {
  if (record.lastCompletedStreakDay === today) {
    return record.currentStreak <= 1 ? "started" : "active_today";
  }

  const yesterday = previousUtcDay(today);
  const oneSidedToday =
    (record.lastQualifyingDayLow === today) !==
    (record.lastQualifyingDayHigh === today);

  if (oneSidedToday) {
    return "waiting_for_friend";
  }

  if (record.lastCompletedStreakDay === yesterday && record.currentStreak > 0) {
    return "at_risk";
  }

  if (record.longestStreak > 0 && record.currentStreak === 0) {
    return "broken";
  }

  return "none";
}

export function viewerStatus(
  record: UmStreakRecord,
  viewerId: string,
  today: string
): UmStreakViewerStatus {
  const resolved = resolveStreakState(record, today);
  let state = resolved.streakState;

  const viewerIsLow = viewerId === resolved.userLowId;
  const myDay = viewerIsLow
    ? resolved.lastQualifyingDayLow
    : resolved.lastQualifyingDayHigh;
  const friendDay = viewerIsLow
    ? resolved.lastQualifyingDayHigh
    : resolved.lastQualifyingDayLow;

  if (resolved.lastCompletedStreakDay !== today) {
    if (myDay === today && friendDay !== today) {
      state = "waiting_for_friend";
    } else if (friendDay === today && myDay !== today) {
      state = "you_need_to_reply";
    }
  }

  return {
    state,
    currentStreak: resolved.currentStreak,
    longestStreak: resolved.longestStreak,
    badges: badgesFromLongest(resolved.longestStreak),
  };
}

function isStreakExpired(record: UmStreakRecord, today: string): boolean {
  if (!record.lastCompletedStreakDay) {
    return record.currentStreak > 0;
  }
  const yesterday = previousUtcDay(today);
  return (
    record.lastCompletedStreakDay !== today &&
    record.lastCompletedStreakDay !== yesterday
  );
}
