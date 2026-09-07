import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findRepoRoot, loadLockConfig } from "./engine";

describe("authoritative registries", () => {
  it("locks Watch Phase 1 20% swipe OWNER_PASS and keeps UM Streak OWNER_PASS", () => {
    const config = loadLockConfig(findRepoRoot());
    expect(config.baselines.current_fold6_watch_status).toBe(
      "PHASE1_20_PERCENT_OWNER_PASS_LOCKED"
    );
    expect(config.contracts.current_fold6_watch_status).toBe(
      "PHASE1_20_PERCENT_OWNER_PASS_LOCKED"
    );
    expect(config.contracts.contracts).toHaveLength(25);
    const byId = Object.fromEntries(
      config.contracts.contracts.map((row) => [row.id, row])
    );
    expect(byId.WATCH_20_PERCENT_SHORT_SWIPE.owner_status).toBe("OWNER_PASS");
    expect(byId.WATCH_20_PERCENT_SHORT_SWIPE.reference_sha).toBe(
      "f1e85475b5ab19b09884f70bc370ff77afe43905"
    );
    expect(byId.WATCH_80_PERCENT_HANDOFF.owner_status).toBe("SUPERSEDED");
    expect(byId.WATCH_NO_BLACK_SURFACE.owner_status).toBe("DEVICE_FAIL");
    expect(byId.WATCH_NO_AUDIO_BLEED.owner_status).toBe("DEVICE_FAIL");
    expect(byId.WATCH_NO_SNAPBACK.owner_status).toBe("DEVICE_FAIL");
    const phase1 = config.baselines.baselines.find(
      (row) => row.feature_id === "WATCH_20_PERCENT_SHORT_SWIPE"
    );
    expect(phase1?.owner_status).toBe("OWNER_PASS");
    expect(phase1?.accepted_sha).toBe(
      "f1e85475b5ab19b09884f70bc370ff77afe43905"
    );
    expect(phase1?.accepted_eas_build_id).toBe(
      "40b685de-2efc-4fd5-b8e1-31cacd8e8397"
    );
    expect(phase1?.accepted_device).toBe("RFCX718LVHK / SM-F956B");
    expect(config.ledger.DESKTOP_WATCH_PHASE1_20_PERCENT_DEVICE_GATE_V1).toEqual({
      task_id: "DESKTOP_WATCH_PHASE1_20_PERCENT_DEVICE_GATE_V1",
      authorized_sha: "f1e85475b5ab19b09884f70bc370ff77afe43905",
      max_eas_builds: 1,
      build_count: 1,
      eas_build_ids: ["40b685de-2efc-4fd5-b8e1-31cacd8e8397"],
    });
    const streak = config.baselines.baselines.find(
      (row) => row.feature_id === "UM_STREAK_LIVE_CAMERA_RETENTION_11C0719"
    );
    expect(streak?.owner_status).toBe("OWNER_PASS");
    expect(streak?.accepted_sha).toBe(
      "11c0719f70fb014e0c0219a679c5a92a1b1815af"
    );
    expect(streak?.accepted_eas_build_id).toBe(
      "e6ece863-3e88-46b5-a26d-80f69a6f1eb2"
    );
    expect(streak?.accepted_device).toBe("RFCX718LVHK / SM-F956B");
    const watchBaseline = config.baselines.baselines.find(
      (row) => row.feature_id === "WATCH_DEVICE_ROLLBACK_1C56ACA"
    );
    expect(watchBaseline?.owner_status).toBe("DEVICE_FAIL");
    const signatures = JSON.parse(
      readFileSync(
        join(findRepoRoot(), "config/regression-lock/FAILURE_SIGNATURES.json"),
        "utf8"
      )
    ) as { signatures: { id: string; resolved: boolean }[] };
    expect(
      signatures.signatures.find((item) => item.id === "20_PERCENT_SHORT_SWIPE_MISSING")
        ?.resolved
    ).toBe(true);
    for (const id of ["BLACK_VIDEO_SURFACE", "NEXT_AUDIO_PREVIOUS_VIDEO"]) {
      const row = signatures.signatures.find((item) => item.id === id);
      expect(row?.resolved).toBe(false);
    }
  });
});
