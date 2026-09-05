import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActionResult } from "@/src/lib/messenger/api";
import {
  mapMessengerMessageRow,
  type MessengerMessageRow,
} from "@/src/lib/messenger/mapMessage";
import type { Message } from "@/src/lib/messenger/types";
import { loadBlockedUsers } from "@/src/lib/social/ugcModeration";

import { utcDayKey } from "./calendar";
import { umStreakText } from "./copy";
import { viewerStatus } from "./engine";
import { canSendPrivateVisual } from "./privacy";
import type { UmStreakRecord, UmStreakViewerStatus } from "./types";
import { shouldMintVisualSignedUrl } from "./visualMessage";

export async function isPeerBlockedForUmStreak(peerId: string): Promise<boolean> {
  if (!peerId) return false;
  const blocked = await loadBlockedUsers();
  return blocked.some((row) => row.userId === peerId);
}

export async function sendVisualMessage(
  supabase: SupabaseClient,
  currentUserId: string,
  input: {
    conversationId: string;
    storagePath: string;
    mimeType: string;
    mediaType: "image" | "video";
    caption?: string | null;
    clientId?: string | null;
    byteSize?: number | null;
    width?: number | null;
    height?: number | null;
    durationMs?: number | null;
    peerId?: string | null;
  }
): Promise<ActionResult<{ message: Message }>> {
  if (input.peerId) {
    const blocked = await isPeerBlockedForUmStreak(input.peerId);
    if (!canSendPrivateVisual({ blocked }).allowed) {
      return { ok: false, message: umStreakText("blocked") };
    }
  }

  const { data, error } = await supabase.rpc("send_um_visual_message", {
    p_conversation_id: input.conversationId,
    p_storage_path: input.storagePath,
    p_mime_type: input.mimeType,
    p_media_type: input.mediaType,
    p_caption: input.caption ?? null,
    p_client_id: input.clientId ?? null,
    p_byte_size: input.byteSize ?? null,
    p_width: input.width ?? null,
    p_height: input.height ?? null,
    p_duration_ms: input.durationMs ?? null,
    p_expiration_policy: "view_once",
  });

  if (error) {
    const text = (error.message || "").toLowerCase();
    if (text.includes("blocked")) {
      return { ok: false, message: umStreakText("blocked") };
    }
    if (text.includes("could not find") || text.includes("does not exist")) {
      return { ok: false, message: umStreakText("sendFailed") };
    }
    return { ok: false, message: umStreakText("sendFailed") };
  }

  return {
    ok: true,
    message: mapMessengerMessageRow(
      data as MessengerMessageRow,
      currentUserId
    ),
  };
}

export async function openVisualMessage(
  supabase: SupabaseClient,
  currentUserId: string,
  messageId: string
): Promise<ActionResult<{ message: Message; signedUrl: string | null }>> {
  const { data: existing } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body, message_type, created_at, deleted_at, edited_at, client_id, visual_opened_at, visual_expires_at, visual_expiration_policy"
    )
    .eq("id", messageId)
    .maybeSingle();

  const existingRow = existing as MessengerMessageRow | null;

  if (
    existingRow &&
    !shouldMintVisualSignedUrl({
      visualOpenedAt: existingRow.visual_opened_at,
      senderId: existingRow.sender_id ?? "",
      currentUserId,
    })
  ) {
    return {
      ok: true,
      message: mapMessengerMessageRow(existingRow, currentUserId),
      signedUrl: null,
    };
  }

  let signedUrl: string | null = null;
  const { data: attachment } = await supabase
    .from("message_attachments")
    .select("storage_bucket, storage_path")
    .eq("message_id", messageId)
    .maybeSingle();

  if (attachment?.storage_bucket && attachment.storage_path) {
    const signed = await supabase.storage
      .from(attachment.storage_bucket)
      .createSignedUrl(attachment.storage_path, 90);
    signedUrl = signed.data?.signedUrl ?? null;
  }

  const { data, error } = await supabase.rpc("open_um_visual_message", {
    p_message_id: messageId,
  });

  if (error) {
    const text = (error.message || "").toLowerCase();
    if (text.includes("blocked") || text.includes("not a participant")) {
      return { ok: false, message: umStreakText("openFailed") };
    }
    if (text.includes("already opened")) {
      const mapped = existingRow
        ? mapMessengerMessageRow(existingRow, currentUserId)
        : null;
      if (!mapped) {
        return { ok: false, message: umStreakText("openFailed") };
      }
      return { ok: true, message: mapped, signedUrl: null };
    }
    return { ok: false, message: umStreakText("openFailed") };
  }

  const mapped = mapMessengerMessageRow(
    data as MessengerMessageRow,
    currentUserId
  );

  const firstOpen =
    !existingRow?.visual_opened_at &&
    Boolean(mapped.visual?.viewed || mapped.visual?.openedAt) &&
    mapped.senderId !== currentUserId;
  const senderPreview = mapped.senderId === currentUserId;

  if ((firstOpen || senderPreview) && mapped.visual) {
    mapped.visual = {
      ...mapped.visual,
      previewUrl: signedUrl,
    };
  }

  return {
    ok: true,
    message: mapped,
    signedUrl: firstOpen || senderPreview ? signedUrl : null,
  };
}

export async function getConversationUmStreak(
  supabase: SupabaseClient,
  currentUserId: string,
  conversationId: string
): Promise<ActionResult<{ streak: UmStreakViewerStatus | null }>> {
  const { data, error } = await supabase.rpc("get_um_streak_for_conversation", {
    p_conversation_id: conversationId,
  });

  if (error) {
    const text = (error.message || "").toLowerCase();
    if (text.includes("could not find") || text.includes("does not exist")) {
      return { ok: true, streak: null };
    }
    return { ok: false, message: umStreakText("openFailed") };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: true, streak: null };
  }

  const record: UmStreakRecord = {
    pairKey: row.pair_key,
    userLowId: row.user_low_id,
    userHighId: row.user_high_id,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastQualifyingDayLow: row.last_qualifying_day_low,
    lastQualifyingDayHigh: row.last_qualifying_day_high,
    lastCompletedStreakDay: row.last_completed_streak_day,
    streakState: row.streak_state,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    streak: viewerStatus(record, currentUserId, utcDayKey(new Date())),
  };
}
