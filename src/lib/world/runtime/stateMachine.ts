import type { WorldFoundationSnapshot } from "@/src/lib/world/types";
import type { WorldRuntimePhase } from "@/src/lib/world/runtime/types";

const ALLOWED: Record<WorldRuntimePhase, ReadonlySet<WorldRuntimePhase>> = {
  preparing: new Set(["loading"]),
  loading: new Set(["ready", "unavailable", "error"]),
  ready: new Set(["loading", "preparing"]),
  unavailable: new Set(["loading", "preparing"]),
  error: new Set(["loading", "preparing"]),
};

export function canTransitionWorldRuntimePhase(
  from: WorldRuntimePhase,
  to: WorldRuntimePhase
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.has(to) === true;
}

/**
 * Resolve terminal phase after a load attempt (fail-closed).
 */
export function resolveWorldRuntimePhaseAfterLoad(options: {
  dataSourceBound: boolean;
  snapshot: WorldFoundationSnapshot | null;
  errorMessage?: string | null;
}): WorldRuntimePhase {
  if (options.errorMessage) return "error";
  if (!options.dataSourceBound) return "unavailable";
  if (!options.snapshot) return "unavailable";

  switch (options.snapshot.status) {
    case "ready":
      return "ready";
    case "error":
      return "error";
    case "empty":
    case "unavailable":
    default:
      return "unavailable";
  }
}

export function worldRuntimePhaseMessage(
  phase: WorldRuntimePhase,
  fallback?: string | null
): string {
  switch (phase) {
    case "preparing":
      return "Preparing World…";
    case "loading":
      return "Loading World…";
    case "ready":
      return fallback?.trim() || "World is ready.";
    case "unavailable":
      return fallback?.trim() || "World map is temporarily unavailable.";
    case "error":
      return "Unable to load World.";
    default:
      return "World";
  }
}
