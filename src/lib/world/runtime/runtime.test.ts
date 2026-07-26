import { describe, expect, it } from "vitest";

import {
  defaultWorldPermissions,
  emptyWorldFilter,
} from "@/src/lib/world/actions";
import { createDisabledWorldRendererAdapter } from "@/src/lib/world/adapter";
import { listWorldCategories } from "@/src/lib/world/categories";
import type { WorldFoundationSnapshot } from "@/src/lib/world/types";
import {
  canTransitionWorldRuntimePhase,
  createMockWorldDataSource,
  createUnboundWorldDataSource,
  createWorldRuntimeController,
  isWorldDataSourceBound,
  resolveWorldRuntimePhaseAfterLoad,
} from "@/src/lib/world/runtime";

function readySnapshot(
  partial?: Partial<WorldFoundationSnapshot>
): WorldFoundationSnapshot {
  return {
    status: "ready",
    message: "World data ready (mock).",
    categories: listWorldCategories({ includeUnsupported: true }).map(
      (c) => c.id
    ),
    layers: [],
    permissions: defaultWorldPermissions(),
    camera: null,
    filter: emptyWorldFilter(),
    renderer: createDisabledWorldRendererAdapter().capability,
    ...partial,
  };
}

describe("world runtime state machine", () => {
  it("allows preparing → loading → terminal phases", () => {
    expect(canTransitionWorldRuntimePhase("preparing", "loading")).toBe(true);
    expect(canTransitionWorldRuntimePhase("loading", "ready")).toBe(true);
    expect(canTransitionWorldRuntimePhase("loading", "unavailable")).toBe(
      true
    );
    expect(canTransitionWorldRuntimePhase("loading", "error")).toBe(true);
    expect(canTransitionWorldRuntimePhase("preparing", "ready")).toBe(false);
  });

  it("resolves fail-closed phases from load results", () => {
    expect(
      resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: false,
        snapshot: readySnapshot(),
      })
    ).toBe("unavailable");
    expect(
      resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: true,
        snapshot: readySnapshot(),
      })
    ).toBe("ready");
    expect(
      resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: true,
        snapshot: readySnapshot({ status: "unavailable" }),
      })
    ).toBe("unavailable");
    expect(
      resolveWorldRuntimePhaseAfterLoad({
        dataSourceBound: true,
        snapshot: null,
        errorMessage: "boom",
      })
    ).toBe("error");
  });
});

describe("world runtime controller", () => {
  it("starts in preparing then lands unavailable without a bound source", async () => {
    const controller = createWorldRuntimeController({
      dataSource: createUnboundWorldDataSource(),
      yieldMs: 0,
    });
    expect(controller.getRuntimeState().phase).toBe("preparing");
    expect(isWorldDataSourceBound(createUnboundWorldDataSource())).toBe(
      false
    );

    const phases: string[] = [];
    controller.subscribe(() => {
      phases.push(controller.getRuntimeState().phase);
    });

    await controller.start();
    expect(controller.getRuntimeState().phase).toBe("unavailable");
    expect(controller.getRuntimeState().dataSourceBound).toBe(false);
    expect(controller.getViewState().phase).toBe("unavailable");
    expect(phases).toContain("loading");
    expect(JSON.stringify(controller.getRuntimeState())).not.toMatch(
      /maplibre|mapbox|google|cesium|pmtiles/i
    );
  });

  it("retry re-enters loading then may remain unavailable", async () => {
    const controller = createWorldRuntimeController({ yieldMs: 0 });
    await controller.start();
    expect(controller.getRuntimeState().phase).toBe("unavailable");
    const before = controller.getRuntimeState().attempt;

    await controller.retry();
    expect(controller.getRuntimeState().attempt).toBe(before + 1);
    expect(controller.getRuntimeState().phase).toBe("unavailable");
    // Demo places remain available even when World data source is unbound.
    expect(controller.getViewState().entities.length).toBeGreaterThan(0);
  });

  it("reaches ready with a mock bound data source", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataSource: createMockWorldDataSource({
        snapshot: readySnapshot(),
        available: true,
      }),
    });
    await controller.start();
    expect(controller.getRuntimeState().phase).toBe("ready");
    expect(controller.getViewState().phase).toBe("ready");
    expect(controller.getRuntimeState().dataSourceBound).toBe(true);
  });

  it("enters error when the data source throws", async () => {
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataSource: createMockWorldDataSource({
        snapshot: readySnapshot(),
        available: true,
        failWith: "source failed",
      }),
    });
    await controller.start();
    expect(controller.getRuntimeState().phase).toBe("error");
    expect(controller.getRuntimeState().errorMessage).toBe("source failed");
    expect(controller.getViewState().phase).toBe("error");
  });

  it("exposes loading during an in-flight start", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const controller = createWorldRuntimeController({
      yieldMs: 0,
      dataSource: {
        id: "slow",
        isAvailable: () => true,
        async loadSnapshot() {
          await gate;
          return readySnapshot();
        },
      },
    });

    const pending = controller.start();
    // Allow microtasks from start() to set loading
    await Promise.resolve();
    expect(["preparing", "loading"]).toContain(
      controller.getRuntimeState().phase
    );
    release();
    await pending;
    expect(controller.getRuntimeState().phase).toBe("ready");
  });
});
