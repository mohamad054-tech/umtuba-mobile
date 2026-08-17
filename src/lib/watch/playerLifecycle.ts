/**
 * Shared Watch player lifecycle.
 *
 * PRODUCT: ONLY_ACTIVE_WATCH_POST_CAN_PRODUCE_AUDIO
 * IMPLEMENTATION: pause + mute + loop=false on still-mounted non-active
 * players. Native release is owned by useVideoPlayer / useReleasingSharedObject.
 * JS must detach (mark dead, drop refs) and never call play/pause/mute after.
 */

export function detachWatchPlayerBinding(input: {
  markDead: () => void;
  clearPlayGeneration: () => void;
  dropBoundRef: () => void;
}): void {
  input.markDead();
  input.clearPlayGeneration();
  input.dropBoundRef();
}

/** Unmount/swap must not invoke player methods. Native release owns teardown. */
export function shouldCallPlayerMethodsOnUnmount(): false {
  return false;
}
