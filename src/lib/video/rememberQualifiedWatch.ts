import type { SupabaseClient } from "@supabase/supabase-js";

import { recordWatchCompletion } from "@/src/lib/supabase/watchCompletions";

import { rememberLocalWatchHide } from "./watchHideStorage";

const remembered = new Set<number>();

export function resetRememberedQualifiedWatchesForTests(): void {
  remembered.clear();
}

/**
 * Mark a video as watched for the 14-day hide window.
 * Always writes device storage (guests). Signed-in users also persist
 * through record_post_watch_completion.
 * Does not touch record_post_view / posts.views / watch_signals.
 */
export async function rememberQualifiedWatch(
  supabase: SupabaseClient,
  postId: number,
  userId: string | null | undefined
): Promise<void> {
  if (!Number.isInteger(postId) || postId <= 0 || remembered.has(postId)) {
    return;
  }
  remembered.add(postId);
  await rememberLocalWatchHide(postId);
  if (!userId) {
    return;
  }
  const result = await recordWatchCompletion(supabase, postId);
  if (!result.ok) {
    remembered.delete(postId);
  }
}
