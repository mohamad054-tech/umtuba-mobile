import {
  WATCH_SHARE_CHOICES,
  createShareAttempt,
  type ShareAttempt,
  type WatchShareMode,
} from "@/src/lib/social/sharePost";

/**
 * Shared Watch Share entry (iOS + Android). Native adapters run only after
 * this menu is shown. expo-sharing / Intent availability must not hide or
 * disable the rail control.
 */
export const WATCH_SHARE_ENTRY_PLATFORMS = ["ios", "android"] as const;

export type WatchShareEntryPlatform =
  (typeof WATCH_SHARE_ENTRY_PLATFORMS)[number];

export type WatchShareChoice = {
  mode: WatchShareMode;
  key: (typeof WATCH_SHARE_CHOICES)[number]["key"];
};

export type WatchShareEntry = {
  attempt: ShareAttempt;
  choices: readonly WatchShareChoice[];
};

export type WatchShareRailAction = {
  visible: true;
  enabled: boolean;
  disabled: boolean;
};

function hasShareablePostId(postId?: number | null): postId is number {
  return typeof postId === "number" && Number.isInteger(postId) && postId > 0;
}

/**
 * Share arrow stays visible on both platforms. It is enabled whenever the
 * current Watch item has a real post id. `platform` is accepted so callers
 * can pass OS and tests can prove it never gates the control.
 */
export function isWatchShareEntryEnabled(input: {
  postId?: number | null;
  platform?: string | null;
}): boolean {
  void input.platform;
  return hasShareablePostId(input.postId);
}

export function resolveWatchShareRailAction(input: {
  postId?: number | null;
  platform?: string | null;
}): WatchShareRailAction {
  const enabled = isWatchShareEntryEnabled(input);
  return { visible: true, enabled, disabled: !enabled };
}

export function listWatchShareChoices(): readonly WatchShareChoice[] {
  return WATCH_SHARE_CHOICES;
}

/**
 * Opens the shared two-option Share UI for the captured post. Does not call
 * Share.share, expo-sharing, or any other native adapter.
 */
export function openWatchShareEntry(input: {
  postId?: number | null;
  platform?: string | null;
}): WatchShareEntry | null {
  if (!hasShareablePostId(input.postId)) return null;
  void input.platform;
  const attempt = createShareAttempt(input.postId);
  if (!attempt) return null;
  return { attempt, choices: listWatchShareChoices() };
}
