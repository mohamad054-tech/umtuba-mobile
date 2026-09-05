import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { MessengerMessageRow } from "@/src/lib/messenger/mapMessage";

export type MessengerRealtimeClient = Pick<
  SupabaseClient,
  "channel" | "getChannels" | "removeChannel"
>;

export type MessengerRealtimeHandlers = {
  onMessageInsert: (row: MessengerMessageRow) => void;
  onMessageUpdate: (row: MessengerMessageRow) => void;
  onInboxParticipantChange?: (row: {
    conversation_id?: string;
    unread_count?: number | null;
  }) => void;
  onResync?: () => void;
};

export function messengerThreadTopic(conversationId: string): string {
  return `messenger:${conversationId}`;
}

export function messengerInboxTopic(userId: string): string {
  return `messenger-inbox:${userId}`;
}

export function umStreakTopic(conversationId: string): string {
  return `um-streak:${conversationId}`;
}

export function realtimeTopic(name: string): string {
  return `realtime:${name}`;
}

export function isManagedRealtimeTopic(topic: string, name: string): boolean {
  const exact = realtimeTopic(name);
  return topic === exact || topic.startsWith(`${exact}:`);
}

function canAttachPostgresChanges(channel: RealtimeChannel): boolean {
  if (channel.joinedOnce) return false;
  const adapter = (
    channel as RealtimeChannel & {
      channelAdapter?: {
        isJoined?: () => boolean;
        isJoining?: () => boolean;
      };
    }
  ).channelAdapter;
  return !adapter?.isJoined?.() && !adapter?.isJoining?.();
}

export function evictRealtimeChannels(
  supabase: MessengerRealtimeClient,
  name: string
): RealtimeChannel[] {
  const evicted: RealtimeChannel[] = [];
  for (const channel of supabase.getChannels()) {
    if (!isManagedRealtimeTopic(channel.topic, name)) continue;
    evicted.push(channel);
    void supabase.removeChannel(channel);
  }
  return evicted;
}

/**
 * Always return a channel that has not been subscribed yet.
 * supabase.channel(name) reuses an existing topic, and realtime-js throws if
 * postgres_changes is added after subscribe().
 */
export function createUnsubscribedChannel(
  supabase: MessengerRealtimeClient,
  name: string
): RealtimeChannel {
  evictRealtimeChannels(supabase, name);

  const wanted = realtimeTopic(name);
  const existing = supabase
    .getChannels()
    .find((channel) => channel.topic === wanted);

  if (existing && canAttachPostgresChanges(existing)) {
    return existing;
  }

  if (existing) {
    const generation = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    return supabase.channel(`${name}:g${generation}`);
  }

  return supabase.channel(name);
}

function subscribeConfiguredChannel(
  supabase: MessengerRealtimeClient,
  name: string,
  configure: (channel: RealtimeChannel) => RealtimeChannel,
  onSubscribed?: () => void
): RealtimeChannel {
  const channel = configure(createUnsubscribedChannel(supabase, name));
  return channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      onSubscribed?.();
    }
  });
}

/**
 * Thread messages use `messenger:<conversationId>`.
 * Inbox participant updates use `messenger-inbox:<userId>` only when requested.
 * UM Streak must never attach postgres_changes to those topics — use
 * `um-streak:<conversationId>` if a dedicated stream is added.
 */
export function subscribeMessengerRealtime(
  supabase: MessengerRealtimeClient,
  input: {
    conversationId: string | null;
    currentUserId: string;
    handlers: MessengerRealtimeHandlers;
  }
): () => void {
  const channels: RealtimeChannel[] = [];

  const track = (channel: RealtimeChannel) => {
    channels.push(channel);
    return channel;
  };

  try {
    if (input.conversationId) {
      const conversationId = input.conversationId;
      track(
        subscribeConfiguredChannel(
          supabase,
          messengerThreadTopic(conversationId),
          (channel) =>
            channel
              .on(
                "postgres_changes",
                {
                  event: "INSERT",
                  schema: "public",
                  table: "messages",
                  filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                  input.handlers.onMessageInsert(
                    payload.new as MessengerMessageRow
                  );
                }
              )
              .on(
                "postgres_changes",
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "messages",
                  filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                  input.handlers.onMessageUpdate(
                    payload.new as MessengerMessageRow
                  );
                }
              ),
          () => input.handlers.onResync?.()
        )
      );
    }

    if (input.handlers.onInboxParticipantChange) {
      const onInboxParticipantChange = input.handlers.onInboxParticipantChange;
      track(
        subscribeConfiguredChannel(
          supabase,
          messengerInboxTopic(input.currentUserId),
          (channel) =>
            channel.on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "conversation_participants",
                filter: `user_id=eq.${input.currentUserId}`,
              },
              (payload) => {
                onInboxParticipantChange(
                  payload.new as {
                    conversation_id?: string;
                    unread_count?: number | null;
                  }
                );
              }
            )
        )
      );
    }
  } catch (error) {
    for (const channel of channels) {
      void supabase.removeChannel(channel);
    }
    throw error;
  }

  return () => {
    for (const channel of channels) {
      void supabase.removeChannel(channel);
    }
  };
}
