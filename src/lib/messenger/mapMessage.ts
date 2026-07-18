import {
  computeReceiptStatus,
  type Message,
  type MessageStatus,
} from "@/src/lib/messenger/types";

export type MessengerMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string | null;
  message_type: string;
  created_at: string;
  deleted_at: string | null;
  edited_at?: string | null;
  client_id: string | null;
};

export function deletedMessagePlaceholder(): string {
  return "This message was deleted";
}

export function mapMessengerMessageRow(
  row: MessengerMessageRow,
  currentUserId: string,
  options?: {
    peerLastReadAt?: string | null;
    status?: MessageStatus;
  }
): Message {
  const isDeleted = Boolean(row.deleted_at);
  const isMine = row.sender_id === currentUserId;
  const status = options?.status ?? "sent";

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id ?? "system",
    text: isDeleted
      ? deletedMessagePlaceholder()
      : row.message_type !== "text" || !row.body
        ? row.body || `[${row.message_type}]`
        : row.body,
    sentAt: row.created_at,
    isMine,
    status,
    clientId: row.client_id ?? undefined,
    messageType: row.message_type,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at,
    isDeleted,
    receiptStatus: computeReceiptStatus({
      isMine,
      sentAt: row.created_at,
      peerLastReadAt: options?.peerLastReadAt,
      status,
    }),
  };
}
