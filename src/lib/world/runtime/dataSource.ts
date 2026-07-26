import { getWorldFoundationSnapshot } from "@/src/lib/world/foundation";
import type { WorldFoundationSnapshot } from "@/src/lib/world/types";
import type { WorldDataSource } from "@/src/lib/world/runtime/types";

/**
 * Default unbound source — fail-closed, no map provider.
 * Used when no WorldDataSource is registered.
 */
export function createUnboundWorldDataSource(): WorldDataSource {
  return {
    id: "world-data-none",
    isAvailable(): boolean {
      return false;
    },
    async loadSnapshot(): Promise<WorldFoundationSnapshot> {
      return getWorldFoundationSnapshot();
    },
  };
}

export function isWorldDataSourceBound(
  dataSource: WorldDataSource | null | undefined
): boolean {
  return Boolean(dataSource && dataSource.isAvailable());
}

/**
 * Test/mock helper — builds a bound source that returns a provided snapshot.
 * Must not reference map SDKs or tile URLs.
 */
export function createMockWorldDataSource(options: {
  id?: string;
  snapshot: WorldFoundationSnapshot;
  available?: boolean;
  failWith?: string;
}): WorldDataSource {
  const available = options.available !== false;
  return {
    id: options.id ?? "world-data-mock",
    isAvailable(): boolean {
      return available;
    },
    async loadSnapshot(): Promise<WorldFoundationSnapshot> {
      if (options.failWith) {
        throw new Error(options.failWith);
      }
      return options.snapshot;
    },
  };
}
