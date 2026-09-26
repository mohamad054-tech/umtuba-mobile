export type WatchReadingText = {
  title: string;
  body: string;
};

type WatchLeave = {
  postId: number;
  positionSec: number;
  reading: WatchReadingText | null;
};

let leave: WatchLeave | null = null;
let pending = false;
let openReading = false;

export function resetWatchLeaveForTests(): void {
  leave = null;
  pending = false;
  openReading = false;
}

function cleanSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 10) / 10;
}

/** Remember where the home video stopped when its creator page opens. */
export function rememberWatchLeave(input: {
  postId: number;
  positionSec: number;
}): void {
  if (!Number.isInteger(input.postId) || input.postId <= 0) return;
  leave = {
    postId: input.postId,
    positionSec: cleanSeconds(input.positionSec),
    reading: leave?.postId === input.postId ? leave.reading : null,
  };
  pending = true;
  openReading = false;
}

export function attachWatchReading(
  postId: number,
  reading: WatchReadingText | null
): void {
  if (!leave || leave.postId !== postId) return;
  leave = { ...leave, reading };
}

export function armWatchReading(): void {
  openReading = true;
}

/**
 * One return to the home video. Later visits do not jump the playback
 * again. The reading panel opens only when the viewer asked for it.
 */
export function consumeWatchReturn(postId: number): {
  positionSec: number;
  reading: WatchReadingText | null;
} | null {
  if (!pending || !leave || leave.postId !== postId) return null;
  pending = false;
  const reading = openReading ? leave.reading : null;
  openReading = false;
  return { positionSec: leave.positionSec, reading };
}
