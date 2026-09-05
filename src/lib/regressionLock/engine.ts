import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

import { matchesAny, normalizeRepoPath, parseGitStatusPath } from "./globs.ts";
import type {
  AreaDef,
  BaselineEntry,
  BuildLedgerEntry,
  FileClass,
  GateResult,
  GitPort,
  LockConfig,
  TaskManifest,
  WatchContract,
} from "./types.ts";

export const REQUIRED_MANIFEST_FIELDS = [
  "task_id",
  "owner_goal",
  "base_sha",
  "allowed_files",
  "allowed_modules",
  "forbidden_modules",
  "protected_contracts",
  "required_tests",
  "required_device_gates",
  "eas_allowed",
  "play_allowed",
  "production_allowed",
  "push_allowed",
] as const;

export const KNOWN_PRODUCT_AREAS = [
  "watch",
  "um_streak",
  "messages",
  "create_editor",
  "profile",
  "navigation",
  "store",
  "learning",
  "regression_lock",
  "media_video",
  "cache",
  "audio",
  "auth",
  "supabase_client",
] as const;

const GOVERNANCE_GLOBS = [
  "config/regression-lock/**",
  "config/**",
  "docs/ai/**",
  "scripts/regression-lock/**",
  "scripts/**",
  "src/lib/regressionLock/**",
  "package.json",
  "tsconfig.json",
  "AGENTS.md",
  ".cursor/**",
];

export function fail(command: string, reasons: string[], details?: Record<string, unknown>): GateResult {
  return { ok: false, command, reasons, details };
}

export function pass(command: string, reasons: string[] = [], details?: Record<string, unknown>): GateResult {
  return { ok: true, command, reasons, details };
}

export function formatGate(result: GateResult): string {
  const header = result.ok ? `${result.command} PASS` : `${result.command} FAIL`;
  const body = result.reasons.map((reason) => `- ${reason}`).join("\n");
  return body ? `${header}\n${body}` : header;
}

export function findRepoRoot(start = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "config", "regression-lock"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadLockConfig(root = findRepoRoot()): LockConfig {
  const dir = join(root, "config", "regression-lock");
  const ledgerPath = join(dir, "build-ledger.json");
  return {
    baselines: loadJson(join(dir, "UMTUBA_BASELINES.json")),
    contracts: loadJson(join(dir, "WATCH_CONTRACTS.json")),
    graph: loadJson(join(dir, "DEPENDENCY_GRAPH.json")),
    deviceRequired: loadJson(join(dir, "DEVICE_REQUIRED.json")),
    policy: loadJson(join(dir, "PRESERVATION_POLICY.json")),
    ledger: existsSync(ledgerPath) ? loadJson(ledgerPath) : {},
  };
}

export function createProcessGit(cwd = findRepoRoot()): GitPort {
  const git = (args: string[]): string => {
    const result = spawnSync("git", args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    });
    return (result.stdout ?? "").trim();
  };
  return {
    head: () => git(["rev-parse", "HEAD"]),
    branch: () => git(["branch", "--show-current"]),
    statusPorcelain: () =>
      git(["status", "--porcelain"]).split("\n").map((line) => line.trimEnd()).filter(Boolean),
    diffNames: (from, to) =>
      git(["diff", "--name-only", `${from}...${to}`])
        .split("\n")
        .map(normalizeRepoPath)
        .filter(Boolean),
    worktreeChanged: () =>
      git(["diff", "--name-only", "HEAD"])
        .split("\n")
        .map(normalizeRepoPath)
        .filter(Boolean),
  };
}

export function validateTaskManifest(manifest: Partial<TaskManifest> | null | undefined): GateResult {
  const reasons: string[] = [];
  if (!manifest || typeof manifest !== "object") {
    return fail("regression:task-check", ["No valid task manifest. NO PRODUCT EDIT."]);
  }
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (manifest[field] == null) {
      reasons.push(`Missing required field: ${field}`);
    }
  }
  if (!manifest.task_id || String(manifest.task_id).includes("REPLACE_")) {
    reasons.push("task_id is missing or still a template placeholder.");
  }
  if (!manifest.base_sha || !/^[0-9a-f]{7,40}$/i.test(String(manifest.base_sha))) {
    reasons.push("base_sha must be a git SHA.");
  }
  if (manifest.product_area && !KNOWN_PRODUCT_AREAS.includes(manifest.product_area as never)) {
    reasons.push(`Unknown product_area "${manifest.product_area}". Fail closed.`);
  }
  const claim = manifest.owner_status_claim ?? "NONE";
  if (claim === "OWNER_PASS") {
    const evidence = manifest.device_evidence;
    if (!evidence?.device || !evidence.date) {
      reasons.push("OWNER_PASS claim blocked: device_evidence.device and date are required.");
    }
  }
  if (manifest.eas_allowed === true && !manifest.authorized_sha) {
    reasons.push("eas_allowed=true requires authorized_sha.");
  }
  if (reasons.length > 0) {
    return fail("regression:task-check", reasons);
  }
  return pass("regression:task-check", [`Manifest ${manifest.task_id} is valid.`]);
}

export function loadTaskManifest(path: string): { manifest: TaskManifest | null; result: GateResult } {
  if (!existsSync(path)) {
    return {
      manifest: null,
      result: fail("regression:task-check", [
        `No valid manifest at ${path}. NO PRODUCT EDIT.`,
      ]),
    };
  }
  const manifest = loadJson<TaskManifest>(path);
  return { manifest, result: validateTaskManifest(manifest) };
}

export function areaForFile(file: string, areas: Record<string, AreaDef>): string | null {
  for (const [name, def] of Object.entries(areas)) {
    if (matchesAny(file, def.globs)) return name;
  }
  return null;
}

export function expandDependentAreas(
  start: string[],
  areas: Record<string, AreaDef>
): string[] {
  const out = new Set<string>();
  const queue = [...start];
  while (queue.length > 0) {
    const name = queue.pop();
    if (!name || out.has(name)) continue;
    out.add(name);
    for (const [other, def] of Object.entries(areas)) {
      if (def.depends_on.includes(name) && !out.has(other)) {
        queue.push(other);
      }
    }
  }
  return [...out];
}

export function classifyFile(
  file: string,
  manifest: TaskManifest,
  config: LockConfig
): FileClass {
  const path = normalizeRepoPath(file);
  if (matchesAny(path, GOVERNANCE_GLOBS) && manifest.product_area === "regression_lock") {
    return "IN_SCOPE";
  }
  if (matchesAny(path, manifest.allowed_files)) {
    return "IN_SCOPE";
  }
  const area = areaForFile(path, config.graph.areas);
  if (area && manifest.forbidden_modules.includes(area)) {
    return "OUT_OF_SCOPE";
  }
  const locked = lockedProtectedGlobs(config, manifest);
  if (locked.length > 0 && matchesAny(path, locked)) {
    return "PROTECTED_BASELINE";
  }
  if (area && manifest.allowed_modules.includes(area)) {
    return "SHARED_REQUIRED";
  }
  if (area && expandDependentAreas(manifest.allowed_modules, config.graph.areas).includes(area)) {
    return "SHARED_REQUIRED";
  }
  if (!area && matchesAny(path, GOVERNANCE_GLOBS)) {
    return "IN_SCOPE";
  }
  return "OUT_OF_SCOPE";
}

export function lockedProtectedGlobs(
  config: LockConfig,
  manifest: TaskManifest
): string[] {
  const declared = new Set(manifest.protected_contracts);
  const globs: string[] = [];
  for (const baseline of config.baselines.baselines) {
    if (baseline.owner_status !== "OWNER_PASS") continue;
    if (declared.has(baseline.feature_id)) continue;
    globs.push(...baseline.protected_files);
  }
  for (const contract of config.contracts.contracts) {
    if (contract.owner_status !== "OWNER_PASS") continue;
    if (declared.has(contract.id)) continue;
    globs.push(...contract.owning_files);
  }
  return globs;
}

export function collectChangedFiles(
  git: GitPort,
  baseSha: string
): string[] {
  const names = new Set<string>([
    ...git.diffNames(baseSha, "HEAD"),
    ...git.worktreeChanged(),
  ]);
  for (const line of git.statusPorcelain()) {
    const file = parseGitStatusPath(line);
    if (file) names.add(file);
  }
  return [...names].filter(Boolean);
}

export function checkScope(
  manifest: TaskManifest,
  changedFiles: string[],
  config: LockConfig
): GateResult {
  if (!manifest.product_area || !KNOWN_PRODUCT_AREAS.includes(manifest.product_area as never)) {
    return fail("regression:scope-check", [
      `Unknown or missing product_area "${manifest.product_area ?? ""}". Fail closed.`,
    ]);
  }
  const classified = changedFiles.map((file) => ({
    file,
    cls: classifyFile(file, manifest, config),
  }));
  const bad = classified.filter(
    (row) => row.cls === "OUT_OF_SCOPE" || row.cls === "PROTECTED_BASELINE"
  );
  if (bad.length > 0) {
    return fail(
      "regression:scope-check",
      bad.map((row) => `${row.cls}: ${row.file}`),
      { classified }
    );
  }
  return pass("regression:scope-check", [`${changedFiles.length} file(s) in scope.`], {
    classified,
  });
}

export function checkBaseline(
  manifest: TaskManifest,
  changedFiles: string[],
  config: LockConfig
): GateResult {
  const reasons: string[] = [];
  if (!manifest.product_area) {
    return fail("regression:baseline-check", ["Task scope missing. Fail closed."]);
  }
  const watchTouched = changedFiles.some((file) =>
    matchesAny(file, config.graph.areas.watch?.globs ?? ["app/(tabs)/watch.tsx", "src/lib/watch/**"])
  );
  if (watchTouched && manifest.product_area !== "watch" && !manifest.allowed_modules.includes("watch")) {
    reasons.push(
      "Protected Watch files changed without Watch authorization in the task manifest."
    );
  }
  for (const file of changedFiles) {
    const area = areaForFile(file, config.graph.areas);
    if (area && manifest.forbidden_modules.includes(area)) {
      reasons.push(`Forbidden module "${area}" touched via ${file}.`);
    }
  }
  const locked = lockedProtectedGlobs(config, manifest);
  for (const file of changedFiles) {
    if (matchesAny(file, locked)) {
      reasons.push(
        `OWNER_PASS protected baseline changed without declaring the contract: ${file}`
      );
    }
  }
  if (reasons.length > 0) {
    return fail("regression:baseline-check", reasons);
  }
  return pass("regression:baseline-check", [
    `Scope ${manifest.product_area} does not violate locked baselines.`,
  ]);
}

export function selectRegressionTests(
  changedFiles: string[],
  config: LockConfig
): { tests: string[]; contracts: string[]; areas: string[] } {
  const areas = new Set<string>();
  for (const file of changedFiles) {
    const area = areaForFile(file, config.graph.areas);
    if (area) areas.add(area);
  }
  const expanded = expandDependentAreas([...areas], config.graph.areas);
  const tests = new Set<string>();
  const contracts = new Set<string>();
  for (const name of expanded) {
    const def = config.graph.areas[name];
    if (!def) continue;
    def.expands_tests.forEach((test) => tests.add(test));
    def.expands_contracts.forEach((id) => contracts.add(id));
  }
  for (const contract of config.contracts.contracts) {
    if (
      changedFiles.some((file) =>
        matchesAny(file, [...contract.owning_files, ...contract.dependent_files])
      )
    ) {
      contracts.add(contract.id);
      contract.regression_tests.forEach((test) => tests.add(test));
    }
  }
  return { tests: [...tests], contracts: [...contracts], areas: [...expanded] };
}

export function checkContractPlan(
  manifest: TaskManifest,
  changedFiles: string[],
  config: LockConfig
): GateResult {
  const selected = selectRegressionTests(changedFiles, config);
  const missing = selected.tests.filter(
    (test) => !manifest.required_tests.some((req) => matchTestPlan(req, test))
  );
  if (missing.length > 0) {
    return fail("regression:contracts", [
      "Dependent regression tests are not listed in the task manifest required_tests:",
      ...missing.map((test) => `  ${test}`),
    ], selected);
  }
  return pass("regression:contracts", [
    `Selected ${selected.tests.length} test glob(s) and ${selected.contracts.length} contract(s).`,
  ], selected);
}

function matchTestPlan(required: string, selected: string): boolean {
  return (
    required === selected ||
    matchesAny(selected, [required]) ||
    matchesAny(required, [selected]) ||
    (required.endsWith("/**/*.test.ts") &&
      selected.startsWith(required.replace(/\/\*\*\/\*\.test\.ts$/, "/")))
  );
}

export function promoteLabel(contract: WatchContract): "OWNER_PASS" | "SOURCE_PASS" | "AUTOMATED_PASS" | "DEVICE_FAIL" {
  if (contract.owner_status === "OWNER_PASS") return "OWNER_PASS";
  if (contract.owner_status === "DEVICE_FAIL") return "DEVICE_FAIL";
  if (contract.device_required) return "SOURCE_PASS";
  return "AUTOMATED_PASS";
}

export function assertNotOwnerPassFromTests(label: string): GateResult {
  if (label === "OWNER_PASS") {
    return fail("regression:device-required", [
      "OWNER_PASS cannot be inferred from unit tests.",
    ]);
  }
  return pass("regression:device-required");
}

export function checkPreEas(input: {
  manifest: TaskManifest | null;
  git: GitPort;
  config: LockConfig;
  typecheckPass: boolean;
  localBundlePass: boolean;
  scope: GateResult;
  contracts: GateResult;
  newlyIntroducedDeviceFails: string[];
}): GateResult {
  const reasons: string[] = [];
  if (!input.manifest) {
    reasons.push("Task manifest missing.");
  } else {
    const task = validateTaskManifest(input.manifest);
    if (!task.ok) reasons.push(...task.reasons);
    if (input.manifest.eas_allowed !== true) {
      reasons.push("eas_allowed is not YES.");
    }
    const head = input.git.head();
    if (input.manifest.authorized_sha && input.manifest.authorized_sha !== head) {
      reasons.push(
        `HEAD ${head} is not the authorized SHA ${input.manifest.authorized_sha}.`
      );
    }
    const ledger = input.config.ledger[input.manifest.task_id];
    const max = input.manifest.max_eas_builds ?? input.config.policy.default_max_eas_builds ?? 1;
    if (ledger && ledger.build_count >= max) {
      reasons.push(
        `EAS budget consumed (${ledger.build_count}/${max}). Second build requires a new explicit owner GO.`
      );
    }
  }
  const dirty = input.git.statusPorcelain();
  if (dirty.length > 0) {
    reasons.push("Worktree is dirty. Commit before EAS.");
  }
  if (!input.scope.ok) reasons.push("Scope check failed.");
  if (!input.contracts.ok) reasons.push("Regression contracts failed.");
  if (!input.typecheckPass) reasons.push("Typecheck has not PASSed.");
  if (!input.localBundlePass) reasons.push("Local bundle gate has not PASSed.");
  if (input.newlyIntroducedDeviceFails.length > 0) {
    reasons.push(
      `Unresolved DEVICE_FAIL newly introduced: ${input.newlyIntroducedDeviceFails.join(", ")}`
    );
  }
  if (reasons.length > 0) {
    return fail("regression:pre-eas", reasons, {
      authorized_sha: input.manifest?.authorized_sha ?? null,
      head: input.git.head(),
    });
  }
  return pass("regression:pre-eas", [
    `Authorized SHA ${input.git.head()} may start at most one EAS build.`,
  ]);
}

export function recordBuild(
  ledger: Record<string, BuildLedgerEntry>,
  entry: BuildLedgerEntry
): { ledger: Record<string, BuildLedgerEntry>; result: GateResult } {
  const current = ledger[entry.task_id];
  const max = entry.max_eas_builds || 1;
  const nextCount = (current?.build_count ?? 0) + 1;
  if (nextCount > max) {
    return {
      ledger,
      result: fail("regression:build-lock", [
        `Second EAS build blocked. ${current?.build_count ?? 0}/${max} already used. New owner GO required.`,
      ]),
    };
  }
  const merged: BuildLedgerEntry = {
    task_id: entry.task_id,
    authorized_sha: entry.authorized_sha,
    max_eas_builds: max,
    build_count: nextCount,
    eas_build_ids: [...(current?.eas_build_ids ?? []), ...entry.eas_build_ids],
  };
  return {
    ledger: { ...ledger, [entry.task_id]: merged },
    result: pass("regression:build-lock", [`Recorded build ${nextCount}/${max}.`]),
  };
}

export function freezeOwnerPass(input: {
  baselines: BaselineEntry[];
  feature_id: string;
  accepted_sha: string;
  device: string;
  date: string;
  evidence: string;
}): BaselineEntry[] {
  return input.baselines.map((row) =>
    row.feature_id === input.feature_id
      ? {
          ...row,
          owner_status: "OWNER_PASS",
          accepted_sha: input.accepted_sha,
          accepted_device: input.device,
          accepted_date: input.date,
          notes: `${row.notes ?? ""} OWNER_PASS evidence: ${input.evidence}`.trim(),
        }
      : row
  );
}

export function snapshotBefore(input: {
  manifest: TaskManifest;
  config: LockConfig;
}): Record<string, unknown> {
  const protectedContracts = [
    ...input.config.contracts.contracts
      .filter((row) => row.owner_status === "OWNER_PASS")
      .map((row) => row.id),
    ...input.config.baselines.baselines
      .filter((row) => row.owner_status === "OWNER_PASS")
      .map((row) => row.feature_id),
  ];
  return {
    BASELINE_SNAPSHOT: input.manifest.base_sha,
    PROTECTED_CONTRACTS: protectedContracts,
    EXPECTED_CHANGED_FILES: input.manifest.allowed_files,
    FORBIDDEN_CHANGED_FILES: input.manifest.forbidden_modules,
    REGRESSION_TEST_PLAN: input.manifest.required_tests,
  };
}

export function snapshotAfter(input: {
  expected: Record<string, unknown>;
  actualChangedFiles: string[];
  outOfScopeFiles: string[];
  contractResults: string;
  baselineDrift: string;
}): GateResult {
  const reasons: string[] = [];
  if (input.outOfScopeFiles.length > 0) {
    reasons.push(`OUT_OF_SCOPE_FILES=${input.outOfScopeFiles.join(",")}`);
  }
  if (input.baselineDrift !== "NONE") {
    reasons.push(`BASELINE_DRIFT=${input.baselineDrift}`);
  }
  if (reasons.length > 0) {
    return fail("regression:snapshot", reasons, input);
  }
  return pass("regression:snapshot", ["Drift NONE."], {
    ACTUAL_CHANGED_FILES: input.actualChangedFiles,
    OUT_OF_SCOPE_FILES: [],
    CONTRACT_RESULTS: input.contractResults,
    BASELINE_DRIFT: "NONE",
    ...input.expected,
  });
}

export function writeLedger(root: string, ledger: Record<string, BuildLedgerEntry>): void {
  const path = join(root, "config", "regression-lock", "build-ledger.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
}

export function resolveManifestPath(root: string, override?: string): string {
  if (override) return override;
  if (process.env.UMTUBA_TASK_MANIFEST) return process.env.UMTUBA_TASK_MANIFEST;
  return join(root, "docs", "ai", "tasks", "CURRENT_TASK_MANIFEST.json");
}
