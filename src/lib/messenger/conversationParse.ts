import { initialsFromName, type Conversation } from "@/src/lib/messenger/types";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanHttpUrl(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return text;
  } catch {
    return null;
  }
}

function cleanUnread(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.trunc(value);
}

function cleanIso(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) return null;
  return text;
}

export type ConversationParseInput = {
  id: unknown;
  peerId: unknown;
  peerName?: unknown;
  peerUsername?: unknown;
  peerAvatarUrl?: unknown;
  peerAvatarInitial?: unknown;
  unreadCount?: unknown;
  isTyping?: unknown;
  lastMessagePreview?: unknown;
  lastMessageAt?: unknown;
  peerLastReadAt?: unknown;
  muted?: unknown;
};

/**
 * Fail-closed conversation list item. Returns null when id/peer identity is unusable.
 * Does not invent display names like "UMTUBA User".
 */
export function parseConversation(input: ConversationParseInput): Conversation | null {
  const id = cleanText(input.id);
  const peerId = cleanText(input.peerId);
  if (!id || !peerId) return null;

  const peerName =
    cleanText(input.peerName) ||
    cleanText(input.peerUsername) ||
    null;

  const title = peerName ?? "Direct message";
  const initialRaw = cleanText(input.peerAvatarInitial);
  const peerInitials =
    (initialRaw && initialRaw.slice(0, 2).toUpperCase()) ||
    (peerName ? initialsFromName(peerName) : "DM");

  return {
    id,
    peerId,
    peerName: title,
    peerInitials,
    peerAvatarUrl: cleanHttpUrl(input.peerAvatarUrl),
    unreadCount: cleanUnread(input.unreadCount),
    isTyping: input.isTyping === true,
    lastMessagePreview: cleanText(input.lastMessagePreview) ?? "",
    lastMessageAt: cleanIso(input.lastMessageAt),
    peerLastReadAt: cleanIso(input.peerLastReadAt),
    muted: input.muted === true,
  };
}

export function conversationPreviewText(conversation: Conversation): string {
  if (conversation.isTyping) return "Typing…";
  const preview = conversation.lastMessagePreview.trim();
  return preview.length > 0 ? preview : "No messages yet";
}

export function trustedUnreadCount(conversation: Conversation): number | null {
  if (
    typeof conversation.unreadCount !== "number" ||
    !Number.isFinite(conversation.unreadCount) ||
    conversation.unreadCount <= 0
  ) {
    return null;
  }
  return Math.trunc(conversation.unreadCount);
}
