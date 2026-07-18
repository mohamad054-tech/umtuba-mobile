import type { Conversation, Message } from "@/src/lib/messenger/types";
import { computeReceiptStatus } from "@/src/lib/messenger/types";

/** Stable merge: prefer server id, then clientId; chronological by sentAt then id. */
export function mergeMessages(
  existing: Message[],
  incoming: Message[]
): Message[] {
  const byKey = new Map<string, Message>();

  const keyOf = (m: Message) => {
    if (m.clientId) return `c:${m.clientId}`;
    return `i:${m.id}`;
  };

  for (const msg of existing) {
    byKey.set(keyOf(msg), msg);
  }

  for (const msg of incoming) {
    const key = keyOf(msg);
    const prev = byKey.get(key);
    if (!prev) {
      // Also drop optimistic twin when server arrives with same clientId under id key
      if (msg.clientId) {
        for (const [k, v] of byKey) {
          if (v.clientId === msg.clientId && k !== key) {
            byKey.delete(k);
          }
        }
      }
      if (!msg.id.startsWith("optimistic-")) {
        for (const [k, v] of byKey) {
          if (
            v.id.startsWith("optimistic-") &&
            v.clientId &&
            msg.clientId &&
            v.clientId === msg.clientId
          ) {
            byKey.delete(k);
          }
        }
      }
      byKey.set(key, msg);
      continue;
    }

    // Prefer confirmed server rows over optimistic/failed
    const preferIncoming =
      (prev.status === "sending" || prev.status === "failed") &&
      msg.status !== "sending" &&
      msg.status !== "failed";
    byKey.set(key, preferIncoming ? { ...prev, ...msg } : { ...msg, ...prev, ...msg });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const at = Date.parse(a.sentAt) || 0;
    const bt = Date.parse(b.sentAt) || 0;
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  });
}

export function sortConversations(items: Conversation[]): Conversation[] {
  return items.slice().sort((a, b) => {
    const at = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bt = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return bt - at;
  });
}

export function dedupeConversations(items: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const item of items) {
    map.set(item.id, item);
  }
  return sortConversations(Array.from(map.values()));
}

export function applyPeerReadToMessages(
  messages: Message[],
  peerLastReadAt: string | null
): Message[] {
  return messages.map((msg) => ({
    ...msg,
    receiptStatus: computeReceiptStatus({
      isMine: msg.isMine,
      sentAt: msg.sentAt,
      peerLastReadAt,
      status: msg.status,
    }),
  }));
}

export function createOptimisticMessage(input: {
  conversationId: string;
  senderId: string;
  text: string;
  clientId: string;
  sentAt?: string;
}): Message {
  return {
    id: `optimistic-${input.clientId}`,
    conversationId: input.conversationId,
    senderId: input.senderId,
    text: input.text,
    sentAt: input.sentAt ?? new Date().toISOString(),
    isMine: true,
    status: "sending",
    clientId: input.clientId,
    messageType: "text",
  };
}

export function markOptimisticFailed(
  messages: Message[],
  clientId: string
): Message[] {
  return messages.map((msg) =>
    msg.clientId === clientId && msg.status === "sending"
      ? { ...msg, status: "failed" as const, receiptStatus: undefined }
      : msg
  );
}

export function replaceOptimisticWithServer(
  messages: Message[],
  clientId: string,
  server: Message
): Message[] {
  const without = messages.filter(
    (msg) => !(msg.clientId === clientId && msg.id.startsWith("optimistic-"))
  );
  return mergeMessages(without, [server]);
}

/** Prevent double-send while a clientId is already in-flight. */
export function canSendWithClientId(
  inFlight: Set<string>,
  clientId: string
): boolean {
  return !inFlight.has(clientId);
}

export type AndroidBackResult = "close-thread" | "leave-messages";

/** Android back: close open thread before leaving Messages. */
export function resolveAndroidBack(hasOpenThread: boolean): AndroidBackResult {
  return hasOpenThread ? "close-thread" : "leave-messages";
}

/** Mark-read should run only after the thread loaded successfully. */
export function shouldMarkReadAfterLoad(input: {
  loadedOk: boolean;
  conversationId: string | null;
  messageCount: number;
}): boolean {
  return Boolean(input.loadedOk && input.conversationId);
}

export function preserveDeepLinkMessageId(
  conversationId: string | null,
  messageId: string | null
): { conversationId: string; messageId: string | null } | null {
  if (!conversationId) return null;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(conversationId)) return null;
  const mid =
    messageId && uuidRe.test(messageId) ? messageId : null;
  return { conversationId, messageId: mid };
}
