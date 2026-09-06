import {
  computeReceiptStatus,
  type Message,
  type MessageStatus,
} from "@/src/lib/messenger/types";
import { resolveVisualExpirationPolicy } from "@/src/lib/umStreak/retention";

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
  visual_opened_at?: string | null;
  visual_expires_at?: string | null;
  visual_expiration_policy?: string | null;
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

  const isVisual =
    row.message_type === "image" || row.message_type === "video";

  let text: string;
  if (isDeleted) {
    text = deletedMessagePlaceholder();
  } else if (isVisual) {
    text = row.body?.trim() || "";
  } else if (row.message_type === "text" && row.body?.trim()) {
    text = row.body;
  } else if (row.message_type === "text") {
    text = "";
  } else {
    // Fail-closed: do not invent readable content for unsupported types.
    text = "Unsupported message";
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id ?? "",
    text,
    sentAt: row.created_at,
    isMine,
    status,
    clientId: row.client_id ?? undefined,
    messageType: row.message_type,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at,
    isDeleted,
    visual: isVisual
      ? {
          mediaType: row.message_type as "image" | "video",
          caption: isDeleted ? null : row.body?.trim() || null,
          viewed: Boolean(row.visual_opened_at),
          openedAt: row.visual_opened_at ?? null,
          expirationPolicy: resolveVisualExpirationPolicy(
            row.visual_expiration_policy
          ),
          previewUrl: null,
        }
      : null,
    receiptStatus: computeReceiptStatus({
      isMine,
      sentAt: row.created_at,
      peerLastReadAt: options?.peerLastReadAt,
      status,
    }),
  };
}
