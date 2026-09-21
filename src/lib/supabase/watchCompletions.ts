import type { SupabaseClient } from "@supabase/supabase-js";

import {
  sanitizeWatchHideEntries,
  WATCH_HIDE_WINDOW_MS,
  type WatchHideEntry,
} from "@/src/lib/video/watchHidePolicy";

export async function loadRecentWatchCompletions(
  supabase: SupabaseClient,
  userId: string | null | undefined
): Promise<WatchHideEntry[]> {
  if (!userId) {
    return [];
  }

  const since = new Date(Date.now() - WATCH_HIDE_WINDOW_MS).toISOString();
  const { data, error } = await supabase
    .from("post_watch_completions")
    .select("post_id, watched_at")
    .eq("user_id", userId)
    .gte("watched_at", since)
    .order("watched_at", { ascending: true });

  if (error) {
    console.error("Unable to load watch completions:", error.message);
    return [];
  }

  return sanitizeWatchHideEntries(
    (data ?? []).map((row) => ({
      postId: row.post_id,
      watchedAt: Date.parse(row.watched_at),
    }))
  );
}

export async function recordWatchCompletion(
  supabase: SupabaseClient,
  postId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isInteger(postId) || postId <= 0) {
    return { ok: false, message: "Unable to remember this watch." };
  }

  const { error } = await supabase.rpc("record_post_watch_completion", {
    p_post_id: postId,
  });

  if (error) {
    console.error("record_post_watch_completion failed:", error.message);
    return { ok: false, message: "Unable to remember this watch." };
  }

  return { ok: true };
}
