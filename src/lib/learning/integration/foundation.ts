import type {
  LearningCapability,
  LearningIntegrationSnapshot,
} from "@/src/lib/learning/integration/types";
import type { PlatformPermission } from "@/src/lib/platform";

export function listLearningCapabilities(): LearningCapability[] {
  return [
    { id: "browse", enabled: false },
    { id: "enroll", enabled: false },
    { id: "launch", enabled: false },
    { id: "progress", enabled: false },
    { id: "assessment", enabled: false },
    { id: "certificate", enabled: false },
    { id: "world", enabled: false },
    { id: "games", enabled: false },
    { id: "notifications", enabled: false },
    { id: "messages", enabled: false },
    { id: "wallet", enabled: false },
    { id: "live", enabled: false },
    { id: "ai", enabled: false },
    { id: "platform", enabled: false },
    { id: "future", enabled: false },
  ];
}

export function defaultLearningPermissions(): PlatformPermission[] {
  return [
    { id: "view", granted: false },
    { id: "join", granted: false },
    { id: "share", granted: false },
    { id: "host", granted: false },
    { id: "moderate", granted: false },
  ];
}

export function isLearningIntegrationConfigured(): boolean {
  return false;
}

/**
 * Fail-closed snapshot — empty courses, no fake enrollments/certificates.
 */
export function getLearningIntegrationSnapshot(): LearningIntegrationSnapshot {
  return {
    status: "unavailable",
    message:
      "UM Learning integration foundation is available as contracts only. Courses, lessons, and progress will appear when trusted adapters are bound.",
    capabilities: listLearningCapabilities(),
    permissions: defaultLearningPermissions(),
    courses: [],
  };
}
