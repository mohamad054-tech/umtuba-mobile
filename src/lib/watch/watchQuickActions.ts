import type { WatchGestureSurface } from "./watchGestures";

export const WATCH_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;

export type WatchPlaybackSpeed = (typeof WATCH_PLAYBACK_SPEEDS)[number];

export const DEFAULT_WATCH_PLAYBACK_SPEED: WatchPlaybackSpeed = 1;

export type WatchQuickActionId =
  | "save"
  | "not-interested"
  | "speed"
  | "captions"
  | "report"
  | "share"
  | "follow"
  | "edit-video";

/**
 * Current media has no subtitle track. Captions toggles a larger
 * on-screen post-caption overlay only.
 */
export const WATCH_CAPTIONS_MODE = "post-caption-overlay" as const;

export function hasWatchCaptionTrack(): boolean {
  return false;
}

export function resolveWatchPlaybackSpeed(value: unknown): WatchPlaybackSpeed {
  if (value === 0.5 || value === 1 || value === 1.5 || value === 2) {
    return value;
  }
  return DEFAULT_WATCH_PLAYBACK_SPEED;
}

export function shouldApplyWatchPlaybackSpeed(isActive: boolean): boolean {
  return isActive === true;
}

/** No per-video speed store yet — paging always returns to 1.0x. */
export function resetWatchPlaybackSpeedOnPageChange(): WatchPlaybackSpeed {
  return DEFAULT_WATCH_PLAYBACK_SPEED;
}

export function resolveWatchQuickActions(input: {
  canSave?: boolean;
  canReport?: boolean;
  canShare?: boolean;
  canFollow?: boolean;
  canEdit?: boolean;
}): WatchQuickActionId[] {
  const actions: WatchQuickActionId[] = ["save", "not-interested", "speed", "captions"];
  if (input.canShare !== false) actions.push("share");
  if (input.canEdit) actions.unshift("edit-video");
  if (input.canReport) actions.push("report");
  if (input.canFollow) actions.push("follow");
  return actions;
}

export function isWatchQuickActionChrome(surface: WatchGestureSurface): boolean {
  return surface !== "video";
}
