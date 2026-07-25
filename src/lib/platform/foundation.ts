import { listPlatformCapabilities, listPlatformModules } from "@/src/lib/platform/catalog";
import { emptyPlatformContext } from "@/src/lib/platform/parse";
import type { PlatformFoundationSnapshot } from "@/src/lib/platform/types";

/**
 * Whether a platform integration host is configured.
 * Foundation V1: contracts only — no host binding.
 */
export function isPlatformFoundationConfigured(): boolean {
  return false;
}

/**
 * Snapshot for shells that want a single platform status object.
 * Does not invent entities or enable unimplemented capabilities as true
 * beyond navigation allowlisting.
 */
export function getPlatformFoundationSnapshot(): PlatformFoundationSnapshot {
  return {
    status: isPlatformFoundationConfigured() ? "ready" : "unavailable",
    message: isPlatformFoundationConfigured()
      ? "Platform integration is ready."
      : "Platform integration foundation is available as contracts only. Feature modules continue to use their existing APIs until adapters are bound.",
    modules: listPlatformModules(),
    capabilities: listPlatformCapabilities(),
    context: emptyPlatformContext(),
  };
}
