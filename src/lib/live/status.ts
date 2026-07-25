import type { LiveSessionStatus } from "@/src/lib/live/types";

const STATUS_MAP: Record<string, LiveSessionStatus> = {
  scheduled: "scheduled",
  upcoming: "scheduled",
  live: "live",
  active: "live",
  ended: "ended",
  completed: "ended",
  finished: "ended",
  cancelled: "cancelled",
  canceled: "cancelled",
  unavailable: "unavailable",
};

/**
 * Map a raw status string to a known Live status.
 * Unknown values fail closed (null) — callers must not invent a status.
 */
export function parseLiveSessionStatus(
  raw: string | null | undefined
): LiveSessionStatus | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return STATUS_MAP[key] ?? null;
}

export function liveStatusLabel(status: LiveSessionStatus): string {
  switch (status) {
    case "live":
      return "LIVE";
    case "scheduled":
      return "Scheduled";
    case "ended":
      return "Ended";
    case "cancelled":
      return "Cancelled";
    case "unavailable":
    default:
      return "Unavailable";
  }
}
