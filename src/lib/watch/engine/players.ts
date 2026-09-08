import { clampWatchEngineIndex } from "./identity";
import type { WatchEngineDirection, WatchEnginePlayerSlots } from "./types";

/** Disk cache is not a decoder. Never mount one player per cached file. */
export const WATCH_ENGINE_MAX_PLAYERS = 3;

export function planWatchEnginePlayerSlots(input: {
  settledIndex: number;
  itemCount: number;
  direction?: WatchEngineDirection;
}): WatchEnginePlayerSlots {
  const current = clampWatchEngineIndex(input.settledIndex, input.itemCount);
  if (current == null) {
    return { current: 0, next: null, previous: null };
  }
  const next = clampWatchEngineIndex(current + 1, input.itemCount);
  const wantsPrevious =
    input.direction === "backward" || input.direction === "none";
  const previous = wantsPrevious
    ? clampWatchEngineIndex(current - 1, input.itemCount)
    : null;
  return {
    current,
    next,
    previous,
  };
}

export function watchEnginePlayerCount(slots: WatchEnginePlayerSlots): number {
  return 1 + (slots.next != null ? 1 : 0) + (slots.previous != null ? 1 : 0);
}

export function shouldMountWatchEnginePlayer(input: {
  index: number;
  slots: WatchEnginePlayerSlots;
}): boolean {
  return (
    input.index === input.slots.current ||
    input.index === input.slots.next ||
    input.index === input.slots.previous
  );
}

export function watchEnginePlayerRole(
  index: number,
  slots: WatchEnginePlayerSlots
): "current" | "next" | "previous" | null {
  if (index === slots.current) return "current";
  if (index === slots.next) return "next";
  if (index === slots.previous) return "previous";
  return null;
}
