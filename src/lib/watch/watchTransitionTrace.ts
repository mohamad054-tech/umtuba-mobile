/**
 * Android-only Watch transition marks. No URLs or tokens.
 */

export type WatchTransitionPhase =
  | "current_end"
  | "next_source_activation"
  | "next_ready"
  | "first_frame"
  | "surface_attached"
  | "audio_start";

export type WatchTransitionMark = {
  t: number;
  phase: WatchTransitionPhase;
  index?: number;
  waitedMs?: number;
  readiness?: string;
};

export function markWatchTransition(
  platform: string | null | undefined,
  phase: WatchTransitionPhase,
  extra?: Omit<WatchTransitionMark, "t" | "phase">
): WatchTransitionMark | null {
  if (platform !== "android") return null;
  const mark: WatchTransitionMark = {
    t: Date.now(),
    phase,
    ...extra,
  };
  console.log(`WATCH_TX ${JSON.stringify(mark)}`);
  return mark;
}
