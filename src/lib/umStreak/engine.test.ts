import { describe, expect, it } from "vitest";
import { utcDayKey } from "./calendar";
import {
  applyQualifyingVisualEvent,
  emptyStreakRecord,
  viewerStatus,
} from "./engine";
import { markVisualOpened, visualMediaAccessible } from "./visualMessage";
import { canOpenPrivateVisual, canSendPrivateVisual } from "./privacy";
import type { QualifyingVisualEvent, UmStreakRecord } from "./types";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function event(
  overrides: Partial<QualifyingVisualEvent> & Pick<QualifyingVisualEvent, "eventId" | "occurredAt">
): QualifyingVisualEvent {
  return {
    senderId: USER_A,
    recipientId: USER_B,
    mediaType: "image",
    blocked: false,
    ...overrides,
  };
}

function apply(
  record: UmStreakRecord,
  next: QualifyingVisualEvent,
  seen?: Set<string>
) {
  const result = applyQualifyingVisualEvent({
    record,
    event: next,
    seenEventIds: seen,
  });
  if (result.accepted && seen) {
    seen.add(next.eventId);
  }
  return result;
}

describe("UM Streak engine", () => {
  it("does not increment on same-day duplicate messages from one user", () => {
    const seen = new Set<string>();
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-02T08:00:00.000Z")!;

    const first = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
        occurredAt: "2026-09-02T08:00:00.000Z",
      }),
      seen
    );
    record = first.record;

    const second = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
        occurredAt: "2026-09-02T18:00:00.000Z",
      }),
      seen
    );

    expect(first.accepted).toBe(true);
    expect(first.incremented).toBe(false);
    expect(second.reason).toBe("duplicate_same_day");
    expect(second.incremented).toBe(false);
    expect(second.record.currentStreak).toBe(0);
  });

  it("does not increment on one-sided communication", () => {
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-02T08:00:00.000Z")!;
    const result = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
        occurredAt: "2026-09-02T08:00:00.000Z",
      })
    );
    record = result.record;

    expect(result.reason).toBe("one_sided");
    expect(record.currentStreak).toBe(0);
    expect(viewerStatus(record, USER_A, "2026-09-02").state).toBe(
      "waiting_for_friend"
    );
    expect(viewerStatus(record, USER_B, "2026-09-02").state).toBe(
      "you_need_to_reply"
    );
  });

  it("increments only when both users qualify", () => {
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-02T08:00:00.000Z")!;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4",
        occurredAt: "2026-09-02T08:00:00.000Z",
      })
    ).record;

    const both = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-02T09:00:00.000Z",
      })
    );

    expect(both.incremented).toBe(true);
    expect(both.record.currentStreak).toBe(1);
    expect(both.record.lastCompletedStreakDay).toBe("2026-09-02");
    expect(viewerStatus(both.record, USER_A, "2026-09-02").state).toBe("started");
  });

  it("continues across a UTC day transition and resets after a missed day", () => {
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-01T10:00:00.000Z")!;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6",
        occurredAt: "2026-09-01T10:00:00.000Z",
      })
    ).record;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-01T11:00:00.000Z",
      })
    ).record;
    expect(record.currentStreak).toBe(1);

    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8",
        occurredAt: "2026-09-02T00:00:30.000Z",
      })
    ).record;
    const dayTwo = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-02T00:01:00.000Z",
      })
    );
    expect(utcDayKey("2026-09-01T23:59:00.000Z")).toBe("2026-09-01");
    expect(utcDayKey("2026-09-02T00:00:30.000Z")).toBe("2026-09-02");
    expect(dayTwo.incremented).toBe(true);
    expect(dayTwo.record.currentStreak).toBe(2);

    const missed = viewerStatus(dayTwo.record, USER_A, "2026-09-04");
    expect(missed.currentStreak).toBe(0);
    expect(missed.state).toBe("broken");
    expect(missed.longestStreak).toBe(2);
  });

  it("tracks longest streak after a reset", () => {
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-01T10:00:00.000Z")!;
    for (const day of ["2026-09-01", "2026-09-02", "2026-09-03"] as const) {
      record = apply(
        record,
        event({
          eventId: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa${day.slice(-1)}a`,
          occurredAt: `${day}T10:00:00.000Z`,
        })
      ).record;
      record = apply(
        record,
        event({
          eventId: `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa${day.slice(-1)}b`,
          senderId: USER_B,
          recipientId: USER_A,
          occurredAt: `${day}T11:00:00.000Z`,
        })
      ).record;
    }
    expect(record.currentStreak).toBe(3);
    expect(record.longestStreak).toBe(3);

    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa1c",
        occurredAt: "2026-09-06T10:00:00.000Z",
      })
    ).record;
    const restart = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa1d",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-06T11:00:00.000Z",
      })
    );
    expect(restart.record.currentStreak).toBe(1);
    expect(restart.record.longestStreak).toBe(3);
  });

  it("rejects blocked users and does not award streak days", () => {
    const record = emptyStreakRecord(USER_A, USER_B, "2026-09-02T08:00:00.000Z")!;
    expect(canSendPrivateVisual({ blocked: true }).allowed).toBe(false);
    const result = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa2a",
        occurredAt: "2026-09-02T08:00:00.000Z",
        blocked: true,
      })
    );
    expect(result.reason).toBe("blocked");
    expect(result.record.currentStreak).toBe(0);
  });

  it("protects duplicate event retries", () => {
    const seen = new Set<string>();
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-02T08:00:00.000Z")!;
    const payload = event({
      eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa3a",
      occurredAt: "2026-09-02T08:00:00.000Z",
    });
    record = apply(record, payload, seen).record;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa3b",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-02T09:00:00.000Z",
      }),
      seen
    ).record;
    expect(record.currentStreak).toBe(1);

    const retry = apply(record, payload, seen);
    expect(retry.reason).toBe("duplicate_event");
    expect(retry.incremented).toBe(false);
    expect(retry.record.currentStreak).toBe(1);
  });

  it("treats UTC midnight as the timezone boundary", () => {
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-01T23:59:00.000Z")!;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa4a",
        occurredAt: "2026-09-01T23:59:00.000Z",
      })
    ).record;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa4b",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-01T23:59:30.000Z",
      })
    ).record;
    expect(record.currentStreak).toBe(1);

    const afterMidnight = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa4c",
        occurredAt: "2026-09-02T00:00:01.000Z",
      })
    );
    expect(afterMidnight.reason).toBe("one_sided");
    expect(afterMidnight.incremented).toBe(false);
    expect(afterMidnight.record.lastCompletedStreakDay).toBe("2026-09-01");
  });

  it("continues the next UTC day only after both users qualify again", () => {
    let record = emptyStreakRecord(USER_A, USER_B, "2026-09-01T10:00:00.000Z")!;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa5a",
        occurredAt: "2026-09-01T10:00:00.000Z",
      })
    ).record;
    record = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa5b",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-01T11:00:00.000Z",
      })
    ).record;
    expect(record.currentStreak).toBe(1);

    const onlyANextDay = apply(
      record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa5c",
        occurredAt: "2026-09-02T08:00:00.000Z",
      })
    );
    expect(onlyANextDay.incremented).toBe(false);
    expect(onlyANextDay.reason).toBe("one_sided");

    const bothNextDay = apply(
      onlyANextDay.record,
      event({
        eventId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa5d",
        senderId: USER_B,
        recipientId: USER_A,
        occurredAt: "2026-09-02T09:00:00.000Z",
      })
    );
    expect(bothNextDay.incremented).toBe(true);
    expect(bothNextDay.record.currentStreak).toBe(2);
    expect(viewerStatus(bothNextDay.record, USER_A, "2026-09-02").state).toBe(
      "active_today"
    );
  });

  it("exposes at-risk when yesterday completed and nobody sent today", () => {
    const record = emptyStreakRecord(USER_A, USER_B, "2026-09-01T10:00:00.000Z")!;
    const active = {
      ...record,
      currentStreak: 7,
      longestStreak: 7,
      lastQualifyingDayLow: "2026-09-01",
      lastQualifyingDayHigh: "2026-09-01",
      lastCompletedStreakDay: "2026-09-01",
    };
    const status = viewerStatus(active, USER_A, "2026-09-02");
    expect(status.state).toBe("at_risk");
    expect(status.currentStreak).toBe(7);
    expect(status.badges.find((badge) => badge.days === 7)?.earned).toBe(true);
  });
});

describe("view-once visual messages", () => {
  it("revokes media after the recipient opens it", () => {
    const opened = markVisualOpened(
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        senderId: USER_A,
        recipientId: USER_B,
        conversationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        mediaRef: `${USER_A}/cccccccc-cccc-cccc-cccc-cccccccccccc/x.jpg`,
        mediaType: "image",
        createdAt: "2026-09-02T10:00:00.000Z",
        openedAt: null,
        expiresAt: null,
        expirationPolicy: "view_once",
        caption: "Hi",
        viewed: false,
      },
      USER_B,
      "2026-09-02T10:05:00.000Z",
      false
    );

    expect(opened.opened).toBe(true);
    expect(opened.mediaRevoked).toBe(true);
    expect(visualMediaAccessible(opened.record, "2026-09-02T10:06:00.000Z")).toBe(
      false
    );
  });

  it("does not let a stranger open or replay private media", () => {
    const record = {
      id: "dddddddd-dddd-dddd-dddd-dddddddddddf",
      senderId: USER_A,
      recipientId: USER_B,
      conversationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      mediaRef: `${USER_A}/cccccccc-cccc-cccc-cccc-cccccccccccc/x.jpg`,
      mediaType: "image" as const,
      createdAt: "2026-09-02T10:00:00.000Z",
      openedAt: null,
      expiresAt: null,
      expirationPolicy: "view_once" as const,
      caption: null,
      viewed: false,
    };
    const stranger = "33333333-3333-3333-3333-333333333333";
    expect(
      canOpenPrivateVisual({
        viewerId: stranger,
        senderId: record.senderId,
        recipientId: record.recipientId,
        blocked: false,
        viewed: false,
        expiresAt: null,
        nowIso: "2026-09-02T10:05:00.000Z",
      }).reason
    ).toBe("not_participant");

    const opened = markVisualOpened(
      record,
      stranger,
      "2026-09-02T10:05:00.000Z",
      false
    );
    expect(opened.reason).toBe("not_participant");
    expect(opened.opened).toBe(false);
    expect(visualMediaAccessible(record, "2026-09-02T10:05:00.000Z")).toBe(true);
  });

  it("keeps media revoked after the first recipient open", () => {
    const first = markVisualOpened(
      {
        id: "dddddddd-dddd-dddd-dddd-ddddddddddd0",
        senderId: USER_A,
        recipientId: USER_B,
        conversationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        mediaRef: `${USER_A}/cccccccc-cccc-cccc-cccc-cccccccccccc/x.jpg`,
        mediaType: "image",
        createdAt: "2026-09-02T10:00:00.000Z",
        openedAt: null,
        expiresAt: null,
        expirationPolicy: "view_once",
        caption: null,
        viewed: false,
      },
      USER_B,
      "2026-09-02T10:05:00.000Z",
      false
    );
    const replay = markVisualOpened(
      first.record,
      USER_B,
      "2026-09-02T10:06:00.000Z",
      false
    );
    expect(["already_viewed", "expired"]).toContain(replay.reason);
    expect(replay.opened).toBe(false);
    expect(replay.mediaRevoked).toBe(true);
    expect(
      visualMediaAccessible(first.record, "2026-09-02T10:06:00.000Z")
    ).toBe(false);
  });

  it("does not let a blocked viewer open private media", () => {
    const opened = markVisualOpened(
      {
        id: "dddddddd-dddd-dddd-dddd-ddddddddddde",
        senderId: USER_A,
        recipientId: USER_B,
        conversationId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        mediaRef: `${USER_A}/cccccccc-cccc-cccc-cccc-cccccccccccc/x.jpg`,
        mediaType: "image",
        createdAt: "2026-09-02T10:00:00.000Z",
        openedAt: null,
        expiresAt: null,
        expirationPolicy: "view_once",
        caption: null,
        viewed: false,
      },
      USER_B,
      "2026-09-02T10:05:00.000Z",
      true
    );
    expect(opened.reason).toBe("blocked");
    expect(opened.opened).toBe(false);
  });
});
