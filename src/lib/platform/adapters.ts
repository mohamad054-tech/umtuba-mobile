/**
 * Adapter interfaces only — no implementations, SDKs, or network calls.
 */

import type {
  PlatformAction,
  PlatformContext,
  PlatformEntity,
  PlatformFoundationSnapshot,
} from "@/src/lib/platform/types";

export type PlatformEntityAdapter = {
  readonly id: string;
  parseEntity(raw: unknown): PlatformEntity | null;
};

export type PlatformNavigationAdapter = {
  readonly id: string;
  mapDestination(raw: string | null | undefined): string | null;
};

export type PlatformPermissionAdapter = {
  readonly id: string;
  canPerform(
    context: PlatformContext,
    action: PlatformAction,
    entity: PlatformEntity | null
  ): boolean;
};

export type PlatformCapabilityAdapter = {
  readonly id: string;
  getSnapshot(): PlatformFoundationSnapshot;
};

/** Marker that no concrete platform adapters are bound yet. */
export function isPlatformAdapterBound(): boolean {
  return false;
}
