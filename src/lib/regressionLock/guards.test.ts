import { describe, expect, it } from "vitest";

import {
  assertNotOwnerPassFromTests,
  checkBaseline,
  checkContractPlan,
  checkPreEas,
  checkScope,
  classifyFile,
  promoteLabel,
  recordBuild,
  selectRegressionTests,
  snapshotAfter,
  snapshotBefore,
  validateTaskManifest,
} from "./engine";
import { matchGlob, parseGitStatusPath } from "./globs";
import type {
  GitPort,
  LockConfig,
  TaskManifest,
  WatchContract,
} from "./types";

function streakManifest(overrides: Partial<TaskManifest> = {}): TaskManifest {
  return {
    task_id: "UM_STREAK_SCOPED_V1",
    owner_goal: "Change UM Streak only.",
    base_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
    product_area: "um_streak",
    allowed_files: ["src/lib/umStreak/**", "app/messages/streak-camera.tsx"],
    allowed_modules: ["um_streak", "messages"],
    forbidden_modules: ["watch", "create_editor", "store"],
    protected_contracts: [],
    required_tests: [
      "src/lib/umStreak/**/*.test.ts",
      "src/lib/messenger/**/*.test.ts",
    ],
    required_device_gates: [],
    eas_allowed: false,
    play_allowed: false,
    production_allowed: false,
    push_allowed: false,
    max_eas_builds: 1,
    authorized_sha: null,
    owner_status_claim: "NONE",
    device_evidence: null,
    ...overrides,
  };
}

function watchManifest(overrides: Partial<TaskManifest> = {}): TaskManifest {
  return {
    task_id: "WATCH_SCOPED_V1",
    owner_goal: "Change Watch only.",
    base_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
    product_area: "watch",
    allowed_files: ["app/(tabs)/watch.tsx", "src/lib/watch/**"],
    allowed_modules: ["watch"],
    forbidden_modules: ["store", "create_editor", "learning"],
    protected_contracts: [],
    required_tests: ["src/lib/watch/**/*.test.ts"],
    required_device_gates: ["WATCH_NO_BLACK_SURFACE"],
    eas_allowed: false,
    play_allowed: false,
    production_allowed: false,
    push_allowed: false,
    ...overrides,
  };
}

function fixtureConfig(): LockConfig {
  const ownerPassContract: WatchContract = {
    id: "WATCH_VOLUME_VERTICAL_SIDE_CONTROL",
    owner_status: "OWNER_PASS",
    last_known_accepted_evidence: "Synthetic locked contract for guard tests.",
    reference_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    reference_branch: null,
    regression_tests: ["src/lib/watch/volumeLayout.test.ts"],
    device_required: false,
    failure_signature: null,
    owning_files: ["src/lib/watch/volumeLayout.ts"],
    dependent_files: ["app/(tabs)/watch.tsx"],
  };
  return {
    baselines: {
      current_fold6_watch_status: "DEVICE_FAIL",
      baselines: [
        {
          feature_id: "WATCH_VOLUME_VERTICAL_SIDE_CONTROL",
          product_area: "watch",
          owner_status: "OWNER_PASS",
          accepted_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          required_files: ["src/lib/watch/volumeLayout.ts"],
          protected_files: ["src/lib/watch/volumeLayout.ts"],
          regression_tests: ["src/lib/watch/volumeLayout.test.ts"],
          device_tests: [],
          dependencies: ["watch"],
          known_failure_signatures: [],
          supersedes: [],
          superseded_by: null,
        },
      ],
    },
    contracts: {
      current_fold6_watch_status: "DEVICE_FAIL",
      contracts: [
        ownerPassContract,
        {
          id: "WATCH_NO_BLACK_SURFACE",
          owner_status: "DEVICE_FAIL",
          last_known_accepted_evidence: "Open Fold6 fail.",
          reference_sha: null,
          reference_branch: null,
          regression_tests: ["src/lib/watch/watchCellBinding.test.ts"],
          device_required: true,
          failure_signature: "BLACK_VIDEO_SURFACE",
          owning_files: ["app/(tabs)/watch.tsx"],
          dependent_files: [],
        },
      ],
    },
    graph: {
      areas: {
        watch: {
          globs: ["app/(tabs)/watch.tsx", "src/lib/watch/**"],
          depends_on: ["navigation", "media_video"],
          expands_tests: ["src/lib/watch/**/*.test.ts"],
          expands_contracts: [
            "WATCH_NO_BLACK_SURFACE",
            "WATCH_PLAYER_BINDING",
          ],
        },
        um_streak: {
          globs: ["src/lib/umStreak/**", "app/messages/streak-camera.tsx"],
          depends_on: ["messages"],
          expands_tests: ["src/lib/umStreak/**/*.test.ts"],
          expands_contracts: [],
        },
        messages: {
          globs: ["src/lib/messenger/**", "app/(tabs)/messages.tsx"],
          depends_on: ["navigation"],
          expands_tests: ["src/lib/messenger/**/*.test.ts"],
          expands_contracts: [],
        },
        navigation: {
          globs: ["app/_layout.tsx", "src/lib/nav/**"],
          depends_on: [],
          expands_tests: [
            "src/lib/watch/watchRootRestoreContracts.test.ts",
            "src/lib/messenger/**/*.test.ts",
            "src/lib/umStreak/**/*.test.ts",
          ],
          expands_contracts: [
            "WATCH_BACK_DOUBLE_PRESS",
            "WATCH_PROFILE_RETURN",
          ],
        },
        store: {
          globs: ["src/lib/economy/**"],
          depends_on: [],
          expands_tests: ["src/lib/economy/**/*.test.ts"],
          expands_contracts: [],
        },
        media_video: {
          globs: ["src/lib/video/**"],
          depends_on: [],
          expands_tests: [
            "src/lib/watch/playerLifecycle.test.ts",
            "src/lib/video/**/*.test.ts",
          ],
          expands_contracts: ["WATCH_PLAYER_BINDING"],
        },
      },
    },
    deviceRequired: {
      device_required_contract_ids: ["WATCH_NO_BLACK_SURFACE"],
    },
    policy: { default_max_eas_builds: 1 },
    ledger: {},
  };
}

function gitPort(input: {
  head?: string;
  dirty?: string[];
  changed?: string[];
}): GitPort {
  return {
    head: () => input.head ?? "1c56aca4eccd5795a3aa0429a55d507b855206df",
    branch: () => "desktop/test",
    statusPorcelain: () => input.dirty ?? [],
    diffNames: () => input.changed ?? [],
    worktreeChanged: () => input.changed ?? [],
  };
}

describe("glob matching", () => {
  it("matches watch and um streak prefixes", () => {
    expect(matchGlob("app/(tabs)/watch.tsx", "app/(tabs)/watch.tsx")).toBe(true);
    expect(matchGlob("src/lib/watch/foo.ts", "src/lib/watch/**")).toBe(true);
    expect(matchGlob("src/lib/umStreak/engine.ts", "src/lib/watch/**")).toBe(false);
  });

  it("parses git porcelain without dropping the first path letter", () => {
    expect(parseGitStatusPath(" M AGENTS.md")).toBe("AGENTS.md");
    expect(parseGitStatusPath("M  AGENTS.md")).toBe("AGENTS.md");
    expect(parseGitStatusPath("?? .cursor/")).toBe(".cursor/");
  });
});

describe("A UM Streak task modifying watch.tsx", () => {
  it("BLOCKs", () => {
    const config = fixtureConfig();
    const manifest = streakManifest();
    const changed = ["src/lib/umStreak/engine.ts", "app/(tabs)/watch.tsx"];
    expect(classifyFile("app/(tabs)/watch.tsx", manifest, config)).toBe(
      "OUT_OF_SCOPE"
    );
    expect(checkScope(manifest, changed, config).ok).toBe(false);
    expect(checkBaseline(manifest, changed, config).ok).toBe(false);
  });
});

describe("B Watch task modifying Store", () => {
  it("BLOCKs", () => {
    const result = checkScope(
      watchManifest(),
      ["src/lib/watch/playerLifecycle.ts", "src/lib/economy/parse.ts"],
      fixtureConfig()
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("src/lib/economy/parse.ts");
  });
});

describe("C shared navigation change without dependent tests", () => {
  it("BLOCKs", () => {
    const manifest = streakManifest({
      product_area: "navigation",
      allowed_files: ["app/_layout.tsx", "src/lib/nav/**"],
      allowed_modules: ["navigation"],
      forbidden_modules: [],
      required_tests: ["src/lib/nav/**/*.test.ts"],
    });
    const result = checkContractPlan(manifest, ["app/_layout.tsx"], fixtureConfig());
    expect(result.ok).toBe(false);
    expect(result.reasons.join("\n")).toMatch(
      /watchRootRestoreContracts|messenger|umStreak/
    );
  });
});

describe("D EAS requested with dirty tree", () => {
  it("BLOCKs", () => {
    const manifest = watchManifest({
      eas_allowed: true,
      authorized_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
      required_tests: ["src/lib/watch/**/*.test.ts"],
    });
    const result = checkPreEas({
      manifest,
      git: gitPort({ dirty: [" M app/(tabs)/watch.tsx"] }),
      config: fixtureConfig(),
      typecheckPass: true,
      localBundlePass: true,
      scope: { ok: true, command: "scope", reasons: [] },
      contracts: { ok: true, command: "contracts", reasons: [] },
      newlyIntroducedDeviceFails: [],
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/dirty/i);
  });
});

describe("E EAS requested before local bundle", () => {
  it("BLOCKs", () => {
    const manifest = watchManifest({
      eas_allowed: true,
      authorized_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
    });
    const result = checkPreEas({
      manifest,
      git: gitPort({ dirty: [] }),
      config: fixtureConfig(),
      typecheckPass: true,
      localBundlePass: false,
      scope: { ok: true, command: "scope", reasons: [] },
      contracts: { ok: true, command: "contracts", reasons: [] },
      newlyIntroducedDeviceFails: [],
    });
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/bundle/i);
  });
});

describe("F OWNER_PASS without device evidence", () => {
  it("BLOCKs", () => {
    const result = validateTaskManifest(
      streakManifest({
        owner_status_claim: "OWNER_PASS",
        device_evidence: null,
      })
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/device_evidence/);
  });
});

describe("G second EAS without new GO", () => {
  it("BLOCKs", () => {
    const first = recordBuild(
      {},
      {
        task_id: "WATCH_SCOPED_V1",
        authorized_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
        max_eas_builds: 1,
        build_count: 1,
        eas_build_ids: ["build-1"],
      }
    );
    expect(first.result.ok).toBe(true);
    const second = recordBuild(first.ledger, {
      task_id: "WATCH_SCOPED_V1",
      authorized_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
      max_eas_builds: 1,
      build_count: 1,
      eas_build_ids: ["build-2"],
    });
    expect(second.result.ok).toBe(false);
    const pre = checkPreEas({
      manifest: watchManifest({
        eas_allowed: true,
        authorized_sha: "1c56aca4eccd5795a3aa0429a55d507b855206df",
      }),
      git: gitPort({ dirty: [] }),
      config: { ...fixtureConfig(), ledger: first.ledger },
      typecheckPass: true,
      localBundlePass: true,
      scope: { ok: true, command: "scope", reasons: [] },
      contracts: { ok: true, command: "contracts", reasons: [] },
      newlyIntroducedDeviceFails: [],
    });
    expect(pre.ok).toBe(false);
    expect(pre.reasons.join(" ")).toMatch(/budget|Second build/i);
  });
});

describe("H protected Owner-pass contract without declaration", () => {
  it("BLOCKs", () => {
    const result = checkBaseline(
      watchManifest({ protected_contracts: [] }),
      ["src/lib/watch/volumeLayout.ts"],
      fixtureConfig()
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/OWNER_PASS protected/);
  });
});

describe("I correct scoped task", () => {
  it("PASSes", () => {
    const config = fixtureConfig();
    const manifest = streakManifest();
    const changed = ["src/lib/umStreak/engine.ts"];
    expect(checkScope(manifest, changed, config).ok).toBe(true);
    expect(checkBaseline(manifest, changed, config).ok).toBe(true);
    expect(validateTaskManifest(manifest).ok).toBe(true);
    const selected = selectRegressionTests(changed, config);
    expect(selected.tests.some((test) => test.includes("umStreak"))).toBe(true);
  });
});

describe("device required labels", () => {
  it("never promotes unit pass to OWNER_PASS", () => {
    expect(
      promoteLabel({
        id: "WATCH_NO_BLACK_SURFACE",
        owner_status: "DEVICE_FAIL",
        last_known_accepted_evidence: "",
        reference_sha: null,
        reference_branch: null,
        regression_tests: [],
        device_required: true,
        failure_signature: "BLACK_VIDEO_SURFACE",
        owning_files: [],
        dependent_files: [],
      })
    ).toBe("DEVICE_FAIL");
    expect(assertNotOwnerPassFromTests("SOURCE_PASS").ok).toBe(true);
    expect(assertNotOwnerPassFromTests("OWNER_PASS").ok).toBe(false);
  });
});

describe("snapshot drift", () => {
  it("blocks completion when drift is not NONE", () => {
    const expected = snapshotBefore({
      manifest: streakManifest(),
      config: fixtureConfig(),
    });
    const result = snapshotAfter({
      expected,
      actualChangedFiles: ["app/(tabs)/watch.tsx"],
      outOfScopeFiles: ["app/(tabs)/watch.tsx"],
      contractResults: "FAIL",
      baselineDrift: "OUT_OF_SCOPE",
    });
    expect(result.ok).toBe(false);
  });
});

describe("missing manifest", () => {
  it("fails closed", () => {
    expect(validateTaskManifest(null).ok).toBe(false);
    expect(validateTaskManifest({}).ok).toBe(false);
  });
});
