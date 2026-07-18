import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isOwnedVideoPath,
  POST_VIDEOS_BUCKET,
} from "@/src/contracts/video";

/**
 * Best-effort delete of an owned object after failed publish / cancel cleanup.
 * Never throws.
 */
export async function deleteOwnedVideoObject(
  supabase: SupabaseClient,
  userId: string,
  path: string
): Promise<void> {
  if (!isOwnedVideoPath(userId, path)) {
    console.error(
      "Refusing to delete video object outside caller folder:",
      path
    );
    return;
  }

  const { error } = await supabase.storage
    .from(POST_VIDEOS_BUCKET)
    .remove([path]);

  if (error) {
    console.error("Failed to delete orphaned video object:", path, error);
  }
}
