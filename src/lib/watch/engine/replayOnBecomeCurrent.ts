import type { WatchEngineTimeline } from "./WatchEnginePlayer";

/** Restart if the retained clip is this close to its end. */
export const WATCH_RESTART_NEAR_END_SECONDS = 0.35;
export const WATCH_RESTART_NEAR_END_RATIO = 0.98;

/**
 * After playToEnd the native player and the chrome bar stay at the end.
 * The previous clip is kept mounted, so swipe-back reuses that ended state
 * unless we restart when the clip becomes current again.
 */
export function shouldRestartWatchClipOnBecomeCurrent(input: {
  ended?: boolean;
  currentTime?: number | null;
  duration?: number | null;
  ratio?: number | null;
}): boolean {
  if (input.ended === true) {
    return true;
  }

  const ratio = input.ratio;
  if (typeof ratio === "number" && Number.isFinite(ratio) && ratio >= WATCH_RESTART_NEAR_END_RATIO) {
    return true;
  }

  const duration = input.duration;
  const currentTime = input.currentTime;
  if (
    typeof duration === "number" &&
    duration > 0 &&
    typeof currentTime === "number" &&
    Number.isFinite(currentTime)
  ) {
    return duration - currentTime <= WATCH_RESTART_NEAR_END_SECONDS;
  }

  return false;
}

export function watchTimelineRestarted(
  timeline: WatchEngineTimeline | null
): WatchEngineTimeline {
  return {
    currentTime: 0,
    duration:
      timeline &&
      typeof timeline.duration === "number" &&
      Number.isFinite(timeline.duration) &&
      timeline.duration > 0
        ? timeline.duration
        : 0,
    ratio: 0,
  };
}
