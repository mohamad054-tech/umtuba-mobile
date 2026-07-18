/** Messenger DTOs + pure helpers (mirrors umtuba-web app/messages/types). */

export type MessageStatus = "sending" | "sent" | "failed";

/** Delivery / read ticks for own messages (peer last_read cursor). */
export type ReceiptStatus = "sent" | "delivered" | "seen";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  sentAt: string;
  isMine: boolean;
  status?: MessageStatus;
  clientId?: string;
  receiptStatus?: ReceiptStatus;
  messageType?: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  isDeleted?: boolean;
};

export type Conversation = {
  id: string;
  peerId: string;
  peerName: string;
  peerInitials: string;
  unreadCount: number;
  isTyping: boolean;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  peerLastReadAt?: string | null;
};

export const MESSAGE_PAGE_SIZE = 40;
export const MESSAGE_MAX_LENGTH = 4000;
export const TYPING_ACTIVE_MS = 8000;
export const TYPING_IDLE_CLEAR_MS = 1800;
export const PEER_POLL_MS = 2500;

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";

  const diffMs = Date.now() - created;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatBubbleTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function computeReceiptStatus(input: {
  isMine: boolean;
  sentAt: string;
  peerLastReadAt?: string | null;
  status?: MessageStatus;
}): ReceiptStatus | undefined {
  if (!input.isMine) return undefined;
  if (input.status === "sending" || input.status === "failed") return undefined;
  if (!input.peerLastReadAt) return "sent";

  const sent = Date.parse(input.sentAt);
  const read = Date.parse(input.peerLastReadAt);
  if (Number.isNaN(sent) || Number.isNaN(read)) return "sent";
  return read >= sent ? "seen" : "delivered";
}

export function receiptLabel(status: ReceiptStatus | undefined): string {
  if (status === "seen") return "Seen";
  if (status === "delivered") return "Delivered";
  if (status === "sent") return "Sent";
  return "";
}
