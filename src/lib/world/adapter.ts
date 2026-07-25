import type {
  WorldRendererCapability,
  WorldRendererFamily,
} from "@/src/lib/world/types";

/**
 * Renderer-agnostic adapter slot.
 * Concrete engines bind later without leaking into the domain layer.
 */
export type WorldRendererAdapter = {
  /** Stable opaque adapter id chosen by the app shell — not a vendor name. */
  id: string;
  capability: WorldRendererCapability;
};

export function createDisabledWorldRendererAdapter(): WorldRendererAdapter {
  return {
    id: "world-renderer-none",
    capability: {
      family: "none",
      supportsOffline: false,
      supportsTerrain: false,
      supportsIndoor: false,
      supportsNavigation: false,
    },
  };
}

export function parseWorldRendererFamily(
  raw: string | null | undefined
): WorldRendererFamily | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (
    key === "none" ||
    key === "vector_2d" ||
    key === "globe_3d" ||
    key === "custom"
  ) {
    return key;
  }
  return null;
}

/**
 * Whether a concrete World renderer is bound.
 * Foundation Core: always false — no SDK / no engine installed.
 */
export function isWorldRendererBound(): boolean {
  return false;
}
