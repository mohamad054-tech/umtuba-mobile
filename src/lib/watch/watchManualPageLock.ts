/**
 * Manual first-page (0→1) native pin.
 *
 * Auto-advance already claims then pins via scrollToWatchIndex.
 * Later manual swipes (1→2, 2→3, …) must stay untouched.
 * This helper must never claim or pin page 0.
 */

import { resolveWatchScrollOffset } from "./playbackPolicy";

/** Same settle/viewability lock used by scrollToWatchIndex. */
export const WATCH_MANUAL_FIRST_PAGE_LOCK_MS = 750;

export type ManualWatchNativePin =
  | { pin: false }
  | { pin: true; offset: number; lockMs: number };

export function resolveManualWatchNativePin(input: {
  previousIndex: number;
  claimedIndex: number;
  itemHeight: number;
}): ManualWatchNativePin {
  if (input.previousIndex !== 0) return { pin: false };
  if (input.claimedIndex !== 1) return { pin: false };
  const offset = resolveWatchScrollOffset(1, input.itemHeight);
  if (offset == null || offset <= 0) return { pin: false };
  return {
    pin: true,
    offset,
    lockMs: WATCH_MANUAL_FIRST_PAGE_LOCK_MS,
  };
}
