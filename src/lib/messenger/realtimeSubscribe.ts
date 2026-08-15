/**
 * Realtime channel planning for messenger.
 *
 * supabase-js v2 throws if `.on('postgres_changes')` runs on a channel that is
 * already joining/joined (`cannot add callbacks after subscribe()`).
 * `supabase.channel(name)` returns the existing channel, so the Messages list
 * and a conversation thread must not both `.on()` `messenger-inbox:${userId}`.
 */

export type MessengerRealtimeScope = {
  conversationId: string | null;
  currentUserId: string;
};

export type MessengerRealtimeChannelPlan = {
  threadTopic: string | null;
  inboxTopic: string | null;
};

export function messengerThreadTopic(conversationId: string): string {
  return `messenger:${conversationId}`;
}

export function messengerInboxTopic(userId: string): string {
  return `messenger-inbox:${userId}`;
}

/**
 * List owns the inbox channel. Thread owns only the conversation channel.
 * Opening a thread while the list tab is still mounted must not reuse inbox.
 */
export function planMessengerRealtimeChannels(
  scope: MessengerRealtimeScope
): MessengerRealtimeChannelPlan {
  if (scope.conversationId) {
    return {
      threadTopic: messengerThreadTopic(scope.conversationId),
      inboxTopic: null,
    };
  }
  return {
    threadTopic: null,
    inboxTopic: messengerInboxTopic(scope.currentUserId),
  };
}

/** Mirror of realtime-js: joined/joining channels reject new postgres_changes callbacks. */
export function realtimeChannelAllowsNewCallbacks(
  state: string | undefined | null
): boolean {
  const normalized = (state ?? "").toLowerCase();
  return (
    normalized !== "joined" &&
    normalized !== "joining" &&
    normalized !== "subscribed"
  );
}
