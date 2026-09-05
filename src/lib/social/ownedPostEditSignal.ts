/**
 * In-process signal so Watch can patch the same mounted item after owner edit
 * without remounting the 3-video window. Not realtime.
 */

let pendingPostId: number | null = null;

export function markOwnedPostEdited(postId: number): void {
  if (Number.isInteger(postId) && postId > 0) {
    pendingPostId = postId;
  }
}

export function takeOwnedPostEdited(): number | null {
  const next = pendingPostId;
  pendingPostId = null;
  return next;
}
