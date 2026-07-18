import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

import { getErrorMessage } from "@/src/contracts/validation";
import {
  decodeMessagesCursor,
  encodeMessagesCursor,
} from "@/src/lib/messenger/cursor";
import {
  mapMessengerMessageRow,
  type MessengerMessageRow,
} from "@/src/lib/messenger/mapMessage";
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_PAGE_SIZE,
  TYPING_ACTIVE_MS,
  initialsFromName,
  type Conversation,
  type Message,
} from "@/src/lib/messenger/types";

export type ActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string; requiresAuth?: boolean };

type ParticipantJoinRow = {
  conversation_id: string;
  unread_count: number;
  typing_at: string | null;
  last_read_at: string | null;
  is_muted: boolean;
  muted_until: string | null;
  conversations: {
    id: string;
    kind: string;
    last_message_at: string | null;
    last_message_preview: string | null;
    updated_at: string;
  } | null;
};

function displayNameFromProfile(
  profile:
    | {
        display_name?: string | null;
        full_name?: string | null;
        username?: string | null;
        avatar_initial?: string | null;
        avatar_url?: string | null;
      }
    | undefined,
  fallback: string
): string {
  if (!profile) return fallback;
  return (
    profile.display_name?.trim() ||
    profile.full_name?.trim() ||
    profile.username ||
    fallback
  );
}

async function loadProfilesByIds(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<
  Map<
    string,
    {
      id: string;
      username: string;
      display_name: string | null;
      full_name: string | null;
      avatar_url: string | null;
      avatar_initial: string | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      id: string;
      username: string;
      display_name: string | null;
      full_name: string | null;
      avatar_url: string | null;
      avatar_initial: string | null;
    }
  >();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, full_name, avatar_url, avatar_initial")
    .in("id", unique);

  if (error) {
    console.error("Unable to load messenger profiles:", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id, row as never);
  }
  return map;
}

export function validateMessageBody(
  body: string
): ActionResult<{ body: string }> {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, message: "Message cannot be empty." };
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      message: `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, body: trimmed };
}

export async function listConversationsForUser(
  supabase: SupabaseClient,
  currentUserId: string
): Promise<ActionResult<{ conversations: Conversation[] }>> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(
      `
      conversation_id,
      unread_count,
      typing_at,
      last_read_at,
      is_muted,
      muted_until,
      conversations!inner (
        id,
        kind,
        last_message_at,
        last_message_preview,
        updated_at
      )
    `
    )
    .eq("user_id", currentUserId)
    .eq("is_archived", false);

  if (error) {
    console.error("listConversationsForUser failed:", error);
    return {
      ok: false,
      message: getErrorMessage(
        error,
        "Unable to load conversations. Please try again."
      ),
    };
  }

  const rows = ((data ?? []) as unknown as ParticipantJoinRow[]).filter(
    (row) => row.conversations?.kind === "direct"
  );

  if (rows.length === 0) {
    return { ok: true, conversations: [] };
  }

  const conversationIds = rows.map((row) => row.conversation_id);
  const { data: peerRows, error: peerError } = await supabase.rpc(
    "list_conversation_peers",
    { p_conversation_ids: conversationIds }
  );

  if (peerError) {
    console.error("Unable to load conversation peers:", peerError);
    return {
      ok: false,
      message: getErrorMessage(
        peerError,
        "Unable to load conversations. Please try again."
      ),
    };
  }

  const peers = (peerRows ?? []) as Array<{
    conversation_id: string;
    user_id: string;
    typing_at: string | null;
    last_read_at?: string | null;
  }>;

  const peerByConversation = new Map<string, string>();
  const typingByConversation = new Map<string, boolean>();
  const peerLastReadByConversation = new Map<string, string | null>();
  const typingCutoff = Date.now() - TYPING_ACTIVE_MS;

  for (const peer of peers) {
    if (!peerByConversation.has(peer.conversation_id)) {
      peerByConversation.set(peer.conversation_id, peer.user_id);
      peerLastReadByConversation.set(
        peer.conversation_id,
        peer.last_read_at ?? null
      );
    }
    if (peer.typing_at) {
      const typedAt = new Date(peer.typing_at).getTime();
      if (typedAt >= typingCutoff) {
        typingByConversation.set(peer.conversation_id, true);
      }
    }
  }

  const profiles = await loadProfilesByIds(
    supabase,
    Array.from(peerByConversation.values())
  );

  const conversations = rows
    .map((row): Conversation | null => {
      const conversation = row.conversations;
      if (!conversation) return null;
      const peerId = peerByConversation.get(row.conversation_id) ?? "";
      const profile = profiles.get(peerId);
      const peerName = displayNameFromProfile(profile, "UMTUBA User");

      return {
        id: conversation.id,
        peerId,
        peerName,
        peerInitials: profile?.avatar_initial || initialsFromName(peerName),
        unreadCount: row.unread_count ?? 0,
        isTyping: typingByConversation.get(conversation.id) ?? false,
        lastMessagePreview: conversation.last_message_preview || "",
        lastMessageAt: conversation.last_message_at,
        peerLastReadAt:
          peerLastReadByConversation.get(conversation.id) ?? null,
      };
    })
    .filter((item): item is Conversation => item !== null)
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
      const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
      return bTime - aTime;
    });

  return { ok: true, conversations };
}

export async function listMessagesForConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  conversationId: string,
  cursor?: string | null,
  peerLastReadAt?: string | null
): Promise<
  ActionResult<{
    messages: Message[];
    hasMore: boolean;
    nextCursor: string | null;
  }>
> {
  const decoded = cursor ? decodeMessagesCursor(cursor) : null;
  if (cursor && !decoded) {
    return { ok: false, message: "Invalid message cursor." };
  }

  const { data, error } = await supabase.rpc("list_conversation_messages", {
    p_conversation_id: conversationId,
    p_limit: MESSAGE_PAGE_SIZE + 1,
    p_before_created_at: decoded?.createdAt ?? null,
    p_before_id: decoded?.id ?? null,
  });

  if (error) {
    console.error("listMessagesForConversation failed:", error);
    return {
      ok: false,
      message: getErrorMessage(
        error,
        "Unable to load messages. Please try again."
      ),
    };
  }

  const rows = (data ?? []) as MessengerMessageRow[];
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MESSAGE_PAGE_SIZE) : rows;

  const chronological = page
    .slice()
    .reverse()
    .map((row) =>
      mapMessengerMessageRow(row, currentUserId, {
        peerLastReadAt: peerLastReadAt ?? null,
      })
    );

  const oldest = page[page.length - 1];
  const nextCursor =
    hasMore && oldest
      ? encodeMessagesCursor(oldest.created_at, oldest.id)
      : null;

  return {
    ok: true,
    messages: chronological,
    hasMore,
    nextCursor,
  };
}

export async function getOrCreateDirectConversation(
  supabase: SupabaseClient,
  otherUserId: string
): Promise<ActionResult<{ conversationId: string }>> {
  const { data, error } = await supabase.rpc(
    "get_or_create_direct_conversation",
    { p_other_user_id: otherUserId }
  );

  if (error) {
    console.error("get_or_create_direct_conversation failed:", error);
    const message = (error.message || "").toLowerCase();
    if (message.includes("authentication required")) {
      return {
        ok: false,
        message: "Please sign in to message.",
        requiresAuth: true,
      };
    }
    if (message.includes("user not found")) {
      return { ok: false, message: "That user could not be found." };
    }
    if (message.includes("invalid conversation peer")) {
      return { ok: false, message: "You cannot message this account." };
    }
    return {
      ok: false,
      message: getErrorMessage(
        error,
        "Unable to open conversation. Please try again."
      ),
    };
  }

  const conversationId =
    typeof data === "string" ? data : data != null ? String(data) : "";
  if (!conversationId) {
    return {
      ok: false,
      message: "Unable to open conversation. Please try again.",
    };
  }
  return { ok: true, conversationId };
}

export async function sendTextMessage(
  supabase: SupabaseClient,
  currentUserId: string,
  conversationId: string,
  rawBody: string,
  clientId?: string | null
): Promise<ActionResult<{ message: Message }>> {
  const validated = validateMessageBody(rawBody);
  if (!validated.ok) return validated;

  const insertPayload: {
    conversation_id: string;
    sender_id: string;
    body: string;
    message_type: string;
    client_id?: string;
  } = {
    conversation_id: conversationId,
    sender_id: currentUserId,
    body: validated.body,
    message_type: "text",
  };

  if (clientId?.trim()) {
    insertPayload.client_id = clientId.trim().slice(0, 80);
  }

  const selectCols =
    "id, conversation_id, sender_id, body, message_type, created_at, deleted_at, edited_at, client_id";

  const { data, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select(selectCols)
    .single();

  if (error) {
    if (
      insertPayload.client_id &&
      (error.code === "23505" ||
        (error.message || "").toLowerCase().includes("duplicate"))
    ) {
      const { data: existing } = await supabase
        .from("messages")
        .select(selectCols)
        .eq("conversation_id", conversationId)
        .eq("sender_id", currentUserId)
        .eq("client_id", insertPayload.client_id)
        .maybeSingle();

      if (existing) {
        return {
          ok: true,
          message: mapMessengerMessageRow(
            existing as MessengerMessageRow,
            currentUserId
          ),
        };
      }
    }

    console.error("sendTextMessage failed:", error);
    return {
      ok: false,
      message: getErrorMessage(
        error,
        "Unable to send message. Please try again."
      ),
    };
  }

  return {
    ok: true,
    message: mapMessengerMessageRow(data as MessengerMessageRow, currentUserId),
  };
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  messageId?: string | null
): Promise<ActionResult<{ done: true }>> {
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_message_id: messageId ?? null,
  });

  if (error) {
    console.error("markConversationRead failed:", error);
    return {
      ok: false,
      message: getErrorMessage(error, "Unable to update read state."),
    };
  }
  return { ok: true, done: true };
}

export async function setConversationTyping(
  supabase: SupabaseClient,
  conversationId: string,
  isTyping: boolean
): Promise<ActionResult<{ done: true }>> {
  const { error } = await supabase.rpc("set_conversation_typing", {
    p_conversation_id: conversationId,
    p_is_typing: isTyping,
  });

  if (error) {
    console.error("setConversationTyping failed:", error);
    return {
      ok: false,
      message: getErrorMessage(error, "Unable to update typing state."),
    };
  }
  return { ok: true, done: true };
}

export async function getConversationPeerState(
  supabase: SupabaseClient,
  conversationId: string
): Promise<
  ActionResult<{ isTyping: boolean; peerLastReadAt: string | null }>
> {
  const { data, error } = await supabase.rpc("list_conversation_peers", {
    p_conversation_ids: [conversationId],
  });

  if (error) {
    console.error("getConversationPeerState failed:", error);
    return {
      ok: false,
      message: getErrorMessage(
        error,
        "Unable to refresh conversation status."
      ),
    };
  }

  const peers = (data ?? []) as Array<{
    conversation_id: string;
    typing_at: string | null;
    last_read_at?: string | null;
  }>;
  const peer = peers.find((row) => row.conversation_id === conversationId);
  if (!peer) {
    return { ok: true, isTyping: false, peerLastReadAt: null };
  }

  const typingCutoff = Date.now() - TYPING_ACTIVE_MS;
  let isTyping = false;
  if (peer.typing_at) {
    const typedAt = new Date(peer.typing_at).getTime();
    isTyping = !Number.isNaN(typedAt) && typedAt >= typingCutoff;
  }

  return {
    ok: true,
    isTyping,
    peerLastReadAt: peer.last_read_at ?? null,
  };
}

/** Assert membership before treating a conversation as openable. */
export async function assertConversationMembership(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<ActionResult<{ ok: true }>> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: getErrorMessage(
        error,
        "Unable to open this conversation."
      ),
    };
  }
  if (!data) {
    return {
      ok: false,
      message: "This conversation is unavailable or you do not have access.",
    };
  }
  return { ok: true };
}

export type MessengerRealtimeHandlers = {
  onMessageInsert: (row: MessengerMessageRow) => void;
  onMessageUpdate: (row: MessengerMessageRow) => void;
  onInboxParticipantChange?: (row: {
    conversation_id?: string;
    unread_count?: number | null;
  }) => void;
  onResync?: () => void;
};

/**
 * Subscribe to thread messages + own inbox participant updates.
 * Caller must invoke the returned cleanup (prevents duplicate channels).
 */
export function subscribeMessengerRealtime(
  supabase: SupabaseClient,
  input: {
    conversationId: string | null;
    currentUserId: string;
    handlers: MessengerRealtimeHandlers;
  }
): () => void {
  const channels: RealtimeChannel[] = [];

  if (input.conversationId) {
    const thread = supabase
      .channel(`messenger:${input.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${input.conversationId}`,
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
          filter: `conversation_id=eq.${input.conversationId}`,
        },
        (payload) => {
          input.handlers.onMessageUpdate(
            payload.new as MessengerMessageRow
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          input.handlers.onResync?.();
        }
      });
    channels.push(thread);
  }

  const inbox = supabase
    .channel(`messenger-inbox:${input.currentUserId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "conversation_participants",
        filter: `user_id=eq.${input.currentUserId}`,
      },
      (payload) => {
        input.handlers.onInboxParticipantChange?.(
          payload.new as {
            conversation_id?: string;
            unread_count?: number | null;
          }
        );
      }
    )
    .subscribe();
  channels.push(inbox);

  return () => {
    for (const channel of channels) {
      void supabase.removeChannel(channel);
    }
  };
}

export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 80);
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
