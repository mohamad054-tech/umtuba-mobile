import { describe, expect, it } from "vitest";

import { subscribeMessengerRealtime } from "@/src/lib/messenger/api";
import {
  messengerInboxTopic,
  messengerThreadTopic,
  planMessengerRealtimeChannels,
  realtimeChannelAllowsNewCallbacks,
} from "@/src/lib/messenger/realtimeSubscribe";

const USER = "11111111-1111-4111-8111-111111111111";
const CONVO = "22222222-2222-4222-8222-222222222222";

type MockChannel = {
  topic: string;
  state: string;
  onCalls: number;
  subscribeCalls: number;
  lastOnBeforeSubscribe: boolean;
  on: (type: string, _filter: unknown, _cb: unknown) => MockChannel;
  subscribe: (cb?: (status: string) => void) => MockChannel;
};

function createMockRealtimeClient() {
  const channels = new Map<string, MockChannel>();

  const createChannel = (topic: string): MockChannel => {
    const channel: MockChannel = {
      topic,
      state: "closed",
      onCalls: 0,
      subscribeCalls: 0,
      lastOnBeforeSubscribe: true,
      on(type: string) {
        if (channel.state === "joined" || channel.state === "joining") {
          throw new Error(
            `cannot add \`${type}\` callbacks for ${channel.topic} after \`subscribe()\`.`
          );
        }
        channel.onCalls += 1;
        channel.lastOnBeforeSubscribe = channel.subscribeCalls === 0;
        return channel;
      },
      subscribe(cb?: (status: string) => void) {
        channel.subscribeCalls += 1;
        channel.state = "joined";
        cb?.("SUBSCRIBED");
        return channel;
      },
    };
    return channel;
  };

  return {
    channels,
    channel(topic: string) {
      const existing = channels.get(topic);
      if (existing) return existing;
      const next = createChannel(topic);
      channels.set(topic, next);
      return next;
    },
    removeChannel(channel: MockChannel) {
      channels.delete(channel.topic);
      channel.state = "closed";
    },
  };
}

describe("planMessengerRealtimeChannels", () => {
  it("gives the inbox list only the inbox topic", () => {
    expect(
      planMessengerRealtimeChannels({
        conversationId: null,
        currentUserId: USER,
      })
    ).toEqual({
      threadTopic: null,
      inboxTopic: messengerInboxTopic(USER),
    });
  });

  it("gives a conversation thread only the thread topic", () => {
    expect(
      planMessengerRealtimeChannels({
        conversationId: CONVO,
        currentUserId: USER,
      })
    ).toEqual({
      threadTopic: messengerThreadTopic(CONVO),
      inboxTopic: null,
    });
  });
});

describe("realtimeChannelAllowsNewCallbacks", () => {
  it("rejects joined, joining, and subscribed — never .on() after subscribe", () => {
    expect(realtimeChannelAllowsNewCallbacks("joined")).toBe(false);
    expect(realtimeChannelAllowsNewCallbacks("joining")).toBe(false);
    expect(realtimeChannelAllowsNewCallbacks("subscribed")).toBe(false);
    expect(realtimeChannelAllowsNewCallbacks("SUBSCRIBED")).toBe(false);
    expect(realtimeChannelAllowsNewCallbacks("closed")).toBe(true);
    expect(realtimeChannelAllowsNewCallbacks("errored")).toBe(true);
    expect(realtimeChannelAllowsNewCallbacks(undefined)).toBe(true);
  });
});

describe("subscribeMessengerRealtime", () => {
  const handlers = {
    onMessageInsert: () => undefined,
    onMessageUpdate: () => undefined,
    onInboxParticipantChange: () => undefined,
    onResync: () => undefined,
  };

  it("attaches postgres_changes callbacks before subscribe on the inbox list", () => {
    const supabase = createMockRealtimeClient();
    const cleanup = subscribeMessengerRealtime(supabase as never, {
      conversationId: null,
      currentUserId: USER,
      handlers,
    });
    const inbox = supabase.channels.get(messengerInboxTopic(USER));
    expect(inbox?.onCalls).toBeGreaterThan(0);
    expect(inbox?.subscribeCalls).toBe(1);
    expect(inbox?.lastOnBeforeSubscribe).toBe(true);
    expect(supabase.channels.has(messengerThreadTopic(CONVO))).toBe(false);
    cleanup();
  });

  it("does not .on() the live inbox channel when a conversation opens", () => {
    const supabase = createMockRealtimeClient();
    const listCleanup = subscribeMessengerRealtime(supabase as never, {
      conversationId: null,
      currentUserId: USER,
      handlers,
    });
    const inboxOnAfterList = supabase.channels.get(
      messengerInboxTopic(USER)
    )?.onCalls;

    expect(() => {
      subscribeMessengerRealtime(supabase as never, {
        conversationId: CONVO,
        currentUserId: USER,
        handlers,
      });
    }).not.toThrow();

    expect(supabase.channels.get(messengerInboxTopic(USER))?.onCalls).toBe(
      inboxOnAfterList
    );
    const thread = supabase.channels.get(messengerThreadTopic(CONVO));
    expect(thread?.onCalls).toBeGreaterThan(0);
    expect(thread?.lastOnBeforeSubscribe).toBe(true);
    listCleanup();
  });

  it("skips .on() if the same topic is already joined (re-subscribe race)", () => {
    const supabase = createMockRealtimeClient();
    const first = subscribeMessengerRealtime(supabase as never, {
      conversationId: CONVO,
      currentUserId: USER,
      handlers,
    });
    const onAfterFirst = supabase.channels.get(messengerThreadTopic(CONVO))
      ?.onCalls;

    expect(() => {
      subscribeMessengerRealtime(supabase as never, {
        conversationId: CONVO,
        currentUserId: USER,
        handlers,
      });
    }).not.toThrow();

    expect(supabase.channels.get(messengerThreadTopic(CONVO))?.onCalls).toBe(
      onAfterFirst
    );
    first();
  });
});
