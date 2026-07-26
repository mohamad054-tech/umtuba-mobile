/**
 * Legacy slot API — delegates to Renderer Adapter Foundation.
 * Prefer `@/src/lib/world/renderer` for new code.
 */

import {
  createNullRendererAdapter,
  isRendererAdapterBound,
  type WorldRendererAdapter,
} from "@/src/lib/world/renderer";
import type { WorldRendererFamily } from "@/src/lib/world/types";

export type { WorldRendererAdapter } from "@/src/lib/world/renderer";

/** @deprecated Prefer createNullRendererAdapter */
export function createDisabledWorldRendererAdapter(): WorldRendererAdapter {
  return createNullRendererAdapter();
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
 * Without an adapter argument: always false (no SDK installed globally).
 * With an adapter: delegates to adapter.isBound().
 */
export function isWorldRendererBound(
  adapter?: WorldRendererAdapter | null
): boolean {
  if (adapter === undefined) return false;
  return isRendererAdapterBound(adapter);
}
