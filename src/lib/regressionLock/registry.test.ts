import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findRepoRoot, loadLockConfig } from "./engine";

describe("authoritative registries", () => {
  it("records current Fold6 Watch as DEVICE_FAIL with open signatures", () => {
    const config = loadLockConfig(findRepoRoot());
    expect(config.baselines.current_fold6_watch_status).toBe("DEVICE_FAIL");
    expect(config.contracts.current_fold6_watch_status).toBe("DEVICE_FAIL");
    expect(config.contracts.contracts).toHaveLength(30);
    const byId = Object.fromEntries(
      config.contracts.contracts.map((row) => [row.id, row])
    );
    expect(byId.WATCH_NO_BLACK_SURFACE.owner_status).toBe("DEVICE_FAIL");
    expect(byId.WATCH_80_PERCENT_HANDOFF.owner_status).toBe("DEVICE_FAIL");
    expect(byId.WATCH_NO_AUDIO_BLEED.owner_status).toBe("DEVICE_FAIL");
    expect(byId.WATCH_NO_SNAPBACK.owner_status).toBe("DEVICE_FAIL");
    expect(
      config.contracts.contracts.some((row) => row.owner_status === "OWNER_PASS")
    ).toBe(false);
    const signatures = JSON.parse(
      readFileSync(
        join(findRepoRoot(), "config/regression-lock/FAILURE_SIGNATURES.json"),
        "utf8"
      )
    ) as { signatures: { id: string; resolved: boolean }[] };
    for (const id of [
      "BLACK_VIDEO_SURFACE",
      "80_PERCENT_HANDOFF_MISSING",
      "NEXT_AUDIO_PREVIOUS_VIDEO",
    ]) {
      const row = signatures.signatures.find((item) => item.id === id);
      expect(row?.resolved).toBe(false);
    }
  });
});
