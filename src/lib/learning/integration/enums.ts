import type {
  LearningAvailabilityState,
  LearningCapabilityId,
  LearningLaunchMode,
  LearningPresenceStatus,
} from "@/src/lib/learning/integration/types";

const STATES = new Set<LearningAvailabilityState>([
  "draft",
  "published",
  "enrolled",
  "in_progress",
  "completed",
  "archived",
  "disabled",
  "future",
]);

const CAPABILITIES = new Set<LearningCapabilityId>([
  "browse",
  "enroll",
  "launch",
  "progress",
  "assessment",
  "certificate",
  "world",
  "games",
  "notifications",
  "messages",
  "wallet",
  "live",
  "ai",
  "platform",
  "future",
]);

const PRESENCE = new Set<LearningPresenceStatus>([
  "offline",
  "studying",
  "in_live",
  "away",
  "future",
]);

const LAUNCH_MODES = new Set<LearningLaunchMode>([
  "internal",
  "external",
  "live",
  "future",
]);

function normalize(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  return key.length > 0 ? key : null;
}

export function parseLearningAvailabilityState(
  raw: string | null | undefined
): LearningAvailabilityState | null {
  const key = normalize(raw);
  if (!key || !STATES.has(key as LearningAvailabilityState)) return null;
  return key as LearningAvailabilityState;
}

export function parseLearningCapabilityId(
  raw: string | null | undefined
): LearningCapabilityId | null {
  const key = normalize(raw);
  if (!key || !CAPABILITIES.has(key as LearningCapabilityId)) return null;
  return key as LearningCapabilityId;
}

export function parseLearningPresenceStatus(
  raw: string | null | undefined
): LearningPresenceStatus | null {
  const key = normalize(raw);
  if (!key || !PRESENCE.has(key as LearningPresenceStatus)) return null;
  return key as LearningPresenceStatus;
}

export function parseLearningLaunchMode(
  raw: string | null | undefined
): LearningLaunchMode | null {
  const key = normalize(raw);
  if (!key || !LAUNCH_MODES.has(key as LearningLaunchMode)) return null;
  return key as LearningLaunchMode;
}
