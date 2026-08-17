import { Share } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordPostShare } from "@/src/lib/social/interactions";
import { getOrCreateDeviceViewerKey } from "@/src/lib/social/viewerKey";

export const PUBLIC_WEB_ORIGIN = "https://umtuba.com";

export function buildMobilePostShareUrl(postId: number): string | null {
  if (!Number.isInteger(postId) || postId <= 0) return null;
  return `${PUBLIC_WEB_ORIGIN}/watch?post=${postId}`;
}

export type ShareWatchPostResult =
  | { ok: true; shared: boolean; shares: number; url: string }
  | { ok: false; message: string };

export async function shareWatchPost(
  supabase: SupabaseClient,
  input: { postId: number; title?: string; text?: string }
): Promise<ShareWatchPostResult> {
  const url = buildMobilePostShareUrl(input.postId);
  if (!url) {
    return { ok: false, message: "Unable to share this post." };
  }

  const title = input.title?.trim() || "UMTUBA";
  const text = input.text?.trim() || "Check out this post on UMTUBA";
  const message = `${text}\n${url}`;

  try {
    const result = await Share.share(
      { title, message, url },
      { dialogTitle: title, subject: title }
    );
    const dismissed =
      "dismissedAction" in Share && result.action === Share.dismissedAction;
    if (dismissed) {
      return { ok: true, shared: false, shares: 0, url };
    }
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : "Unable to share this post.";
    if (/user.?cancel|dismiss/i.test(messageText)) {
      return { ok: true, shared: false, shares: 0, url };
    }
    return { ok: false, message: messageText };
  }

  const viewerKey = await getOrCreateDeviceViewerKey();
  const recorded = await recordPostShare(supabase, input.postId, viewerKey);
  if (!recorded.ok) {
    return { ok: true, shared: true, shares: 0, url };
  }
  return { ok: true, shared: true, shares: recorded.shares, url };
}
