import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findRepoRoot, loadLockConfig } from "./engine";

describe("authoritative registries", () => {
  it("locks current clean-room Watch OWNER_PASS and keeps historical Phase 1 plus UM Streak", () => {
    const config = loadLockConfig(findRepoRoot());
    expect(config.baselines.current_fold6_watch_status).toBe(
      "CLEAN_ROOM_ENGINE_OWNER_PASS_LOCKED"
    );
    expect(config.contracts.current_fold6_watch_status).toBe(
      "CLEAN_ROOM_ENGINE_OWNER_PASS_LOCKED"
    );
    expect(config.contracts.contracts).toHaveLength(33);
    const byId = Object.fromEntries(
      config.contracts.contracts.map((row) => [row.id, row])
    );
    expect(byId.WATCH_20_PERCENT_SHORT_SWIPE.owner_status).toBe("OWNER_PASS");
    expect(byId.WATCH_20_PERCENT_SHORT_SWIPE.reference_sha).toBe(
      "f1e85475b5ab19b09884f70bc370ff77afe43905"
    );
    expect(byId.WATCH_80_PERCENT_HANDOFF.owner_status).toBe("SUPERSEDED");
    expect(byId.WATCH_NO_BLACK_SURFACE.owner_status).toBe("OWNER_PASS");
    expect(byId.WATCH_NO_BLACK_SURFACE.reference_sha).toBe(
      "aa57b8aede67b753a95b3f359800cc0df88f147d"
    );
    expect(byId.WATCH_NO_AUDIO_BLEED.owner_status).toBe("DEVICE_FAIL");
    expect(byId.WATCH_NO_SNAPBACK.owner_status).toBe("OWNER_PASS");
    expect(byId.WATCH_CLEAN_ROOM_ENGINE_OWNER_PASS.owner_status).toBe(
      "OWNER_PASS"
    );
    expect(byId.WATCH_CLEAN_ROOM_ENGINE_OWNER_PASS.reference_sha).toBe(
      "aa57b8aede67b753a95b3f359800cc0df88f147d"
    );
    expect(byId.WATCH_ENGINE_COMMIT_FRACTION_0_1.owner_status).toBe(
      "OWNER_PASS"
    );
    expect(byId.WATCH_ENGINE_SNAP_DURATION_MS_120.owner_status).toBe(
      "OWNER_PASS"
    );
    expect(byId.WATCH_TAP_PAUSE_RESUME.owner_status).toBe("OWNER_PASS");
    expect(byId.WATCH_PUBLISH_LOCAL_VISIBLE_BEFORE_UPLOAD.owner_status).toBe(
      "OWNER_PASS"
    );
    expect(byId.WATCH_ENGINE_TEXTUREVIEW.owner_status).toBe("OWNER_PASS");
    expect(byId.WATCH_ENGINE_READY_TO_RENDER.owner_status).toBe("OWNER_PASS");
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
    const cleanRoom = config.baselines.baselines.find(
      (row) => row.feature_id === "WATCH_CLEAN_ROOM_ENGINE_OWNER_PASS"
    );
    expect(cleanRoom?.owner_status).toBe("OWNER_PASS");
    expect(cleanRoom?.accepted_sha).toBe(
      "aa57b8aede67b753a95b3f359800cc0df88f147d"
    );
    expect(cleanRoom?.accepted_eas_build_id).toBe(
      "62bafb12-d89f-4e30-8842-28b391cb3c8d"
    );
    expect(cleanRoom?.accepted_device).toBe("RFCX718LVHK / SM-F956B");
    const baselinesJson = JSON.parse(
      readFileSync(
        join(findRepoRoot(), "config/regression-lock/UMTUBA_BASELINES.json"),
        "utf8"
      )
    ) as {
      current_installed_device_sha: string;
      current_installed_eas_build_id: string;
    };
    expect(baselinesJson.current_installed_device_sha).toBe(
      "aa57b8aede67b753a95b3f359800cc0df88f147d"
    );
    expect(baselinesJson.current_installed_eas_build_id).toBe(
      "62bafb12-d89f-4e30-8842-28b391cb3c8d"
    );
    expect(config.ledger.DESKTOP_WATCH_PHASE1_20_PERCENT_DEVICE_GATE_V1).toEqual({
      task_id: "DESKTOP_WATCH_PHASE1_20_PERCENT_DEVICE_GATE_V1",
      authorized_sha: "f1e85475b5ab19b09884f70bc370ff77afe43905",
      max_eas_builds: 1,
      build_count: 1,
      eas_build_ids: ["40b685de-2efc-4fd5-b8e1-31cacd8e8397"],
    });
    expect(config.ledger.DESKTOP_WATCH_OPTIMISTIC_UPLOAD_PREVIEW_V1).toEqual({
      task_id: "DESKTOP_WATCH_OPTIMISTIC_UPLOAD_PREVIEW_V1",
      authorized_sha: "aa57b8aede67b753a95b3f359800cc0df88f147d",
      max_eas_builds: 1,
      build_count: 1,
      eas_build_ids: ["62bafb12-d89f-4e30-8842-28b391cb3c8d"],
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
    expect(
      signatures.signatures.find((item) => item.id === "BLACK_VIDEO_SURFACE")
        ?.resolved
    ).toBe(true);
    expect(
      signatures.signatures.find((item) => item.id === "NEXT_SWIPE_SNAPBACK_TO_FIRST")
        ?.resolved
    ).toBe(true);
    expect(
      signatures.signatures.find((item) => item.id === "PUBLISH_LOCAL_NOT_VISIBLE_BEFORE_UPLOAD")
        ?.resolved
    ).toBe(true);
    expect(
      signatures.signatures.find((item) => item.id === "NEXT_AUDIO_PREVIOUS_VIDEO")
        ?.resolved
    ).toBe(false);
  });
});
