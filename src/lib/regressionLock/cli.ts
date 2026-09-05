import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import {
  checkBaseline,
  checkContractPlan,
  checkPreEas,
  checkScope,
  collectChangedFiles,
  createProcessGit,
  findRepoRoot,
  formatGate,
  loadLockConfig,
  loadTaskManifest,
  recordBuild,
  resolveManifestPath,
  selectRegressionTests,
  vitestArgsForSelectedTests,
  snapshotAfter,
  snapshotBefore,
  writeLedger,
} from "./engine.ts";
import type { GateResult } from "./types.ts";

function print(result: GateResult): void {
  console.log(formatGate(result));
  if (result.details) {
    console.log(JSON.stringify(result.details, null, 2));
  }
  process.exit(result.ok ? 0 : 1);
}

function main(): void {
  const command = process.argv[2] ?? "help";
  const root = findRepoRoot();
  const config = loadLockConfig(root);
  const git = createProcessGit(root);
  const manifestPath = resolveManifestPath(root, process.argv[3]);
  const loaded = loadTaskManifest(manifestPath);

  if (command === "help") {
    console.log(`UMTUBA regression-lock
  npm run regression:task-check
  npm run regression:baseline-check
  npm run regression:scope-check
  npm run regression:contracts
  npm run regression:pre-eas
  npm run regression:snapshot
  npm run regression:build-lock
`);
    process.exit(0);
  }

  if (command === "task-check") {
    print(loaded.result);
  }

  if (!loaded.manifest || !loaded.result.ok) {
    print(loaded.result);
  }
  const manifest = loaded.manifest;
  const changed = collectChangedFiles(git, manifest.base_sha);

  if (command === "baseline-check") {
    print(checkBaseline(manifest, changed, config));
  }
  if (command === "scope-check") {
    print(checkScope(manifest, changed, config));
  }
  if (command === "contracts") {
    const plan = checkContractPlan(manifest, changed, config);
    if (!plan.ok) print(plan);
    const selected = selectRegressionTests(changed, config);
    if (selected.tests.length === 0) {
      print(plan);
    }
    const run = spawnSync(
      "npx",
      ["vitest", "run", ...vitestArgsForSelectedTests(selected.tests)],
      { cwd: root, stdio: "inherit", shell: true }
    );
    print({
      ...plan,
      ok: plan.ok && (run.status ?? 1) === 0,
      reasons:
        (run.status ?? 1) === 0
          ? plan.reasons
          : [...plan.reasons, "Selected Vitest run failed."],
    });
  }
  if (command === "pre-eas") {
    const scope = checkScope(manifest, changed, config);
    const contracts = checkContractPlan(manifest, changed, config);
    const typecheckPass = process.env.UMTUBA_TYPECHECK_PASS === "1";
    const localBundlePass = process.env.UMTUBA_LOCAL_BUNDLE_PASS === "1";
    print(
      checkPreEas({
        manifest,
        git,
        config,
        typecheckPass,
        localBundlePass,
        scope,
        contracts,
        newlyIntroducedDeviceFails: (process.env.UMTUBA_NEW_DEVICE_FAILS ?? "")
          .split(",")
          .map((row: string) => row.trim())
          .filter(Boolean),
      })
    );
  }
  if (command === "snapshot") {
    const expected = snapshotBefore({ manifest, config });
    console.log(JSON.stringify(expected, null, 2));
    const scope = checkScope(manifest, changed, config);
    const out = ((scope.details?.classified as { file: string; cls: string }[]) ?? [])
      .filter((row) => row.cls === "OUT_OF_SCOPE" || row.cls === "PROTECTED_BASELINE")
      .map((row) => row.file);
    print(
      snapshotAfter({
        expected,
        actualChangedFiles: changed,
        outOfScopeFiles: out,
        contractResults: scope.ok ? "PASS" : "FAIL",
        baselineDrift: out.length > 0 ? "OUT_OF_SCOPE" : "NONE",
      })
    );
  }
  if (command === "build-lock") {
    const buildId = process.argv[4];
    if (!buildId) {
      print({
        ok: false,
        command: "regression:build-lock",
        reasons: ["Usage: regression:build-lock [manifest] <eas-build-id>"],
      });
    }
    const recorded = recordBuild(config.ledger, {
      task_id: manifest.task_id,
      authorized_sha: manifest.authorized_sha ?? git.head(),
      max_eas_builds: manifest.max_eas_builds ?? 1,
      build_count: 1,
      eas_build_ids: [buildId],
    });
    if (recorded.result.ok) {
      writeLedger(root, recorded.ledger);
    }
    print(recorded.result);
  }

  if (command === "device-required") {
    console.log(
      JSON.stringify(
        {
          rule: "Never promote unit PASS to OWNER_PASS.",
          current_fold6_watch_status: config.contracts.current_fold6_watch_status,
          device_required_contract_ids:
            config.deviceRequired.device_required_contract_ids,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  if (!existsSync(manifestPath)) {
    print({
      ok: false,
      command: `regression:${command}`,
      reasons: [`Unknown command ${command}`],
    });
  }
  print({
    ok: false,
    command: `regression:${command}`,
    reasons: [`Unknown command ${command}`],
  });
}

main();
