import {
  defaultWorldPermissions,
  emptyWorldFilter,
} from "@/src/lib/world/actions";
import { createDisabledWorldRendererAdapter } from "@/src/lib/world/adapter";
import { listWorldCategories } from "@/src/lib/world/categories";
import type { WorldFoundationSnapshot } from "@/src/lib/world/types";

/**
 * Whether a trusted World data/render contract is provisioned.
 * Foundation Core: domain contracts only — no live World source yet.
 */
export function isWorldFoundationConfigured(): boolean {
  return false;
}

/**
 * Snapshot for UI shells. Fail-closed unavailable — no fake cities/pins/layers.
 */
export function getWorldFoundationSnapshot(): WorldFoundationSnapshot {
  const renderer = createDisabledWorldRendererAdapter();

  if (!isWorldFoundationConfigured()) {
    return {
      status: "unavailable",
      message:
        "World is not available yet. Domain contracts are ready for a future renderer and data source.",
      categories: listWorldCategories({ includeUnsupported: true }).map(
        (c) => c.id
      ),
      layers: [],
      permissions: defaultWorldPermissions(),
      camera: null,
      filter: emptyWorldFilter(),
      renderer: renderer.capability,
    };
  }

  return {
    status: "empty",
    message: "No World entities are available.",
    categories: listWorldCategories({ includeUnsupported: true }).map(
      (c) => c.id
    ),
    layers: [],
    permissions: defaultWorldPermissions(),
    camera: null,
    filter: emptyWorldFilter(),
    renderer: renderer.capability,
  };
}
