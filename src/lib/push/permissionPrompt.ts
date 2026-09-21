const ASKED_PREFIX = "umtuba.push.friendly-ask.";

export type PushInspectStatus =
  | "undetermined"
  | "granted"
  | "denied"
  | "unavailable";

export function pushFriendlyAskStorageKey(userId: string): string {
  return `${ASKED_PREFIX}${userId}`;
}

/**
 * Android 13+ only. One friendly explanation before the system dialog.
 * Never re-prompts after the user has seen it for this account.
 */
export function shouldExplainPushPermission(input: {
  os: string;
  osVersion: number;
  permission: PushInspectStatus;
  alreadyAsked: boolean;
}): boolean {
  if (input.alreadyAsked) return false;
  if (input.os !== "android") return false;
  if (!Number.isFinite(input.osVersion) || input.osVersion < 33) return false;
  return input.permission === "undetermined";
}
