import { describe, expect, it, vi } from "vitest";

import {
  listMyNotifications,
  parseAppNotification,
  resolveMarkNotificationRead,
} from "@/src/lib/notifications/api";
import { formatNotificationTime } from "@/src/lib/notifications/format";
import {
  canOpenNotificationDestination,
  mapNotificationHrefToMobile,
} from "@/src/lib/notifications/mapHref";
import {
  mapNotificationUiCategory,
  notificationCategoryLabel,
} from "@/src/lib/notifications/mapType";

describe("mapNotificationUiCategory", () => {
  it("maps known families", () => {
    expect(mapNotificationUiCategory("follow")).toBe("social");
    expect(mapNotificationUiCategory("direct_message")).toBe("messages");
    expect(mapNotificationUiCategory("live_started")).toBe("watch");
    expect(mapNotificationUiCategory("learning_qa_answered")).toBe("learning");
    expect(mapNotificationUiCategory("game_invite")).toBe("games");
    expect(mapNotificationUiCategory("um_points_earned")).toBe("system");
  });

  it("fails soft for unknown types", () => {
    expect(mapNotificationUiCategory("brand_new_thing")).toBe("system");
    expect(notificationCategoryLabel("system")).toBe("System");
  });
});

describe("mapNotificationHrefToMobile", () => {
  it("maps supported destinations", () => {
    expect(mapNotificationHrefToMobile("/discover?post=42")).toBe(
      "/(tabs)/watch?post=42"
    );
    expect(mapNotificationHrefToMobile("/watch?post=7")).toBe(
      "/(tabs)/watch?post=7"
    );
    expect(mapNotificationHrefToMobile("/notifications")).toBe(
      "/notifications"
    );
    expect(mapNotificationHrefToMobile("/rewards")).toBe("/rewards");
    expect(
      mapNotificationHrefToMobile(
        "/messages?conversation=11111111-1111-4111-8111-111111111111"
      )
    ).toBe("/messages/11111111-1111-4111-8111-111111111111");
    expect(mapNotificationHrefToMobile("/profile/alice")).toBe(
      "/profile?u=alice"
    );
  });

  it("rejects unsupported destinations without navigating", () => {
    expect(mapNotificationHrefToMobile(null)).toBeNull();
    expect(mapNotificationHrefToMobile("")).toBeNull();
    expect(mapNotificationHrefToMobile("/admin/secret")).toBeNull();
    expect(mapNotificationHrefToMobile("https://evil.example/x")).toBeNull();
    expect(canOpenNotificationDestination("/admin/secret")).toBe(false);
    expect(canOpenNotificationDestination("/notifications")).toBe(true);
  });
});

describe("parseAppNotification", () => {
  it("parses unread/read rows and keeps unknown types renderable", () => {
    const unread = parseAppNotification({
      id: "n1",
      type: "post_like",
      title: "New like",
      body: "Someone liked your clip",
      created_at: "2026-07-25T10:00:00.000Z",
      read_at: null,
      href: "/discover?post=9",
      actor: { id: "u1", username: "sam", displayName: "Sam", avatarInitial: "S" },
    });
    expect(unread).toMatchObject({
      id: "n1",
      unread: true,
      uiCategory: "social",
      title: "New like",
    });

    const read = parseAppNotification({
      id: "n2",
      type: "future_custom_type",
      title: "Hello",
      createdAt: "2026-07-25T11:00:00.000Z",
      readAt: "2026-07-25T11:05:00.000Z",
    });
    expect(read).toMatchObject({
      unread: false,
      uiCategory: "system",
      type: "future_custom_type",
    });
  });

  it("rejects malformed rows", () => {
    expect(parseAppNotification(null)).toBeNull();
    expect(parseAppNotification({ id: "x" })).toBeNull();
  });
});

describe("formatNotificationTime", () => {
  it("formats recent times", () => {
    const now = Date.now();
    expect(
      formatNotificationTime(new Date(now - 30_000).toISOString())
    ).toBe("Just now");
    expect(
      formatNotificationTime(new Date(now - 5 * 60_000).toISOString())
    ).toBe("5m");
  });
});

describe("listMyNotifications / mark read", () => {
  it("lists parsed notifications from RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: "a",
          type: "follow",
          title: "New follower",
          created_at: "2026-07-25T12:00:00.000Z",
          read_at: null,
        },
      ],
      error: null,
    }));
    const client = { rpc } as never;
    const result = await listMyNotifications(client);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.uiCategory).toBe("social");
    }
  });

  it("marks unavailable when RPC is missing", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "Could not find the function list_my_notifications" },
    }));
    const result = await listMyNotifications({ rpc } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable).toBe(true);
    }
  });

  it("falls back to local persistence when mark RPC is missing", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "Could not find the function mark_notification_read" },
    }));
    const result = await resolveMarkNotificationRead({ rpc } as never, "n1");
    expect(result).toEqual({
      ok: true,
      done: true,
      persistence: "local",
    });
  });

  it("persists read on server when mark RPC succeeds", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const result = await resolveMarkNotificationRead({ rpc } as never, "n1");
    expect(result).toEqual({
      ok: true,
      done: true,
      persistence: "server",
    });
  });
});
