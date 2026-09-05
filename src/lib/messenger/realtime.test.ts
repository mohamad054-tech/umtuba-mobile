import { describe, expect, it } from "vitest";

import type { RealtimeChannel } from "@supabase/supabase-js";

import type { MessengerMessageRow } from "@/src/lib/messenger/mapMessage";
import {
  createUnsubscribedChannel,
  messengerInboxTopic,
  messengerThreadTopic,
  realtimeTopic,
  subscribeMessengerRealtime,
  umStreakTopic,
  type MessengerRealtimeClient,
} from "@/src/lib/messenger/realtime";

type PostgresHandler = {
  type: string;
  filter: { event?: string; table?: string; filter?: string };
  callback: (payload: { new: unknown }) => void;
};

class MockChannel {
  topic: string;
  handlers: PostgresHandler[] = [];
  subscribed = false;
  joinedOnce = false;
  removed = false;
  subscribeCalls = 0;

  constructor(name: string) {
    this.topic = realtimeTopic(name);
  }

  on(
    type: string,
    filter: PostgresHandler["filter"],
    callback: PostgresHandler["callback"]
  ) {
    if (this.subscribed && type === "postgres_changes") {
      throw new Error(
        `cannot add \`${type}\` callbacks for ${this.topic} after \`subscribe()\`.`
      );
    }
    this.handlers.push({ type, filter, callback });
    return this;
  }

  subscribe(cb?: (status: string) => void) {
    this.subscribed = true;
    this.joinedOnce = true;
    this.subscribeCalls += 1;
    cb?.("SUBSCRIBED");
    return this;
  }
}

function createMockRealtime() {
  const channels: MockChannel[] = [];

  const client: MessengerRealtimeClient = {
    getChannels: () => channels as unknown as RealtimeChannel[],
    channel(name: string) {
      const topic = realtimeTopic(name);
      const exists = channels.find((channel) => channel.topic === topic);
      if (exists) return exists as unknown as RealtimeChannel;
      const created = new MockChannel(name);
      channels.push(created);
      return created as unknown as RealtimeChannel;
    },
    removeChannel(channel: RealtimeChannel) {
      const mock = channel as unknown as MockChannel;
      return Promise.resolve().then(() => {
        const index = channels.indexOf(mock);
        if (index >= 0) channels.splice(index, 1);
        mock.removed = true;
        mock.subscribed = false;
        return "ok";
      });
    },
  };

  return { client, channels };
}

const CONVERSATION = "d0a021d6-782e-487b-b9b1-707b3b1f8dc5";
const USER = "e41f7a2f-9541-4ac2-929b-97a3bd52c18d";

function messageRow(
  overrides: Partial<MessengerMessageRow> = {}
): MessengerMessageRow {
  return {
    id: "m1",
    conversation_id: CONVERSATION,
    sender_id: USER,
    body: "hello",
    message_type: "text",
    created_at: "2026-09-05T12:00:00.000Z",
    deleted_at: null,
    client_id: null,
    ...overrides,
  };
}

describe("subscribeMessengerRealtime", () => {
  it("registers postgres_changes handlers before subscribe", () => {
    const { client, channels } = createMockRealtime();
    const order: string[] = [];
    const originalChannel = client.channel.bind(client);
    client.channel = (name: string) => {
      const channel = originalChannel(name) as unknown as MockChannel;
      const originalOn = channel.on.bind(channel);
      const originalSubscribe = channel.subscribe.bind(channel);
      channel.on = (...args) => {
        order.push("on");
        return originalOn(...args);
      };
      channel.subscribe = (...args) => {
        order.push("subscribe");
        return originalSubscribe(...args);
      };
      return channel as unknown as RealtimeChannel;
    };

    subscribeMessengerRealtime(client, {
      conversationId: CONVERSATION,
      currentUserId: USER,
      handlers: {
        onMessageInsert: () => undefined,
        onMessageUpdate: () => undefined,
      },
    });

    expect(order).toEqual(["on", "on", "subscribe"]);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.topic).toBe(realtimeTopic(messengerThreadTopic(CONVERSATION)));
    expect(channels[0]?.handlers.map((handler) => handler.filter.table)).toEqual([
      "messages",
      "messages",
    ]);
    expect(channels[0]?.subscribeCalls).toBe(1);
  });

  it("does not add handlers to an already subscribed channel on remount", () => {
    const { client, channels } = createMockRealtime();
    const first = subscribeMessengerRealtime(client, {
      conversationId: CONVERSATION,
      currentUserId: USER,
      handlers: {
        onMessageInsert: () => undefined,
        onMessageUpdate: () => undefined,
      },
    });

    const subscribed = channels[0];
    expect(subscribed?.subscribed).toBe(true);
    expect(subscribed?.handlers).toHaveLength(2);

    expect(() => {
      subscribeMessengerRealtime(client, {
        conversationId: CONVERSATION,
        currentUserId: USER,
        handlers: {
          onMessageInsert: () => undefined,
          onMessageUpdate: () => undefined,
        },
      });
    }).not.toThrow();

    const live = channels.filter((channel) => !channel.removed);
    expect(live.some((channel) => channel === subscribed && channel.handlers.length > 2)).toBe(
      false
    );
    expect(live.some((channel) => channel.subscribed && channel.handlers.length === 2)).toBe(
      true
    );
    first();
  });

  it("cleanup unsubscribes and removes the previous channel", async () => {
    const { client, channels } = createMockRealtime();
    const cleanup = subscribeMessengerRealtime(client, {
      conversationId: CONVERSATION,
      currentUserId: USER,
      handlers: {
        onMessageInsert: () => undefined,
        onMessageUpdate: () => undefined,
        onInboxParticipantChange: () => undefined,
      },
    });

    expect(channels).toHaveLength(2);
    const snapshot = [...channels];
    cleanup();
    await Promise.resolve();
    expect(snapshot.every((channel) => channel.removed)).toBe(true);
    expect(channels).toHaveLength(0);
  });

  it("keeps message realtime functional after inbox + thread subscribe", () => {
    const { client, channels } = createMockRealtime();
    const inserted: string[] = [];
    const updated: string[] = [];
    const inbox: string[] = [];

    subscribeMessengerRealtime(client, {
      conversationId: null,
      currentUserId: USER,
      handlers: {
        onMessageInsert: () => undefined,
        onMessageUpdate: () => undefined,
        onInboxParticipantChange: (row) => {
          if (row.conversation_id) inbox.push(row.conversation_id);
        },
      },
    });

    expect(() => {
      subscribeMessengerRealtime(client, {
        conversationId: CONVERSATION,
        currentUserId: USER,
        handlers: {
          onMessageInsert: (row) => inserted.push(row.id),
          onMessageUpdate: (row) => updated.push(row.id),
        },
      });
    }).not.toThrow();

    const thread = channels.find((channel) =>
      channel.topic.startsWith(realtimeTopic(messengerThreadTopic(CONVERSATION)))
    );
    const inboxChannel = channels.find((channel) =>
      channel.topic.startsWith(realtimeTopic(messengerInboxTopic(USER)))
    );

    expect(thread?.handlers).toHaveLength(2);
    expect(inboxChannel?.handlers).toHaveLength(1);

    thread?.handlers
      .find((handler) => handler.filter.event === "INSERT")
      ?.callback({ new: messageRow({ id: "ins-1" }) });
    thread?.handlers
      .find((handler) => handler.filter.event === "UPDATE")
      ?.callback({ new: messageRow({ id: "upd-1" }) });
    inboxChannel?.handlers[0]?.callback({
      new: { conversation_id: CONVERSATION, unread_count: 2 },
    });

    expect(inserted).toEqual(["ins-1"]);
    expect(updated).toEqual(["upd-1"]);
    expect(inbox).toEqual([CONVERSATION]);
  });

  it("keeps UM Streak refresh on a separate channel from messenger", () => {
    const { client, channels } = createMockRealtime();
    const streakRefresh: string[] = [];

    subscribeMessengerRealtime(client, {
      conversationId: CONVERSATION,
      currentUserId: USER,
      handlers: {
        onMessageInsert: (row) => streakRefresh.push(row.id),
        onMessageUpdate: () => undefined,
      },
    });

    const streak = createUnsubscribedChannel(client, umStreakTopic(CONVERSATION));
    streak
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "um_streak_events",
          filter: `conversation_id=eq.${CONVERSATION}`,
        },
        (payload) => {
          streakRefresh.push(String((payload.new as { id?: string }).id ?? "streak"));
        }
      )
      .subscribe();

    const messengerHandlers = channels
      .filter((channel) => channel.topic.includes(`messenger:${CONVERSATION}`))
      .flatMap((channel) => channel.handlers);
    expect(
      messengerHandlers.every((handler) => handler.filter.table !== "um_streak_events")
    ).toBe(true);
    expect(
      channels.some(
        (channel) => channel.topic === realtimeTopic(umStreakTopic(CONVERSATION))
      )
    ).toBe(true);

    const thread = channels.find((channel) =>
      channel.topic.startsWith(realtimeTopic(messengerThreadTopic(CONVERSATION)))
    );
    if (!thread) throw new Error("missing thread channel");
    thread.handlers
      .find((handler) => handler.filter.event === "INSERT")
      ?.callback({ new: messageRow({ id: "visual-1" }) });
    expect(streakRefresh).toContain("visual-1");
  });
});
