export const OWNER_STATUSES = [
  "OWNER_PASS",
  "SOURCE_PASS_ONLY",
  "DEVICE_FAIL",
  "BLOCKED",
  "SUPERSEDED",
  "FROZEN",
] as const;

export type OwnerStatus = (typeof OWNER_STATUSES)[number];

export type FileClass =
  | "IN_SCOPE"
  | "SHARED_REQUIRED"
  | "OUT_OF_SCOPE"
  | "PROTECTED_BASELINE";

export type TaskManifest = {
  task_id: string;
  owner_goal: string;
  base_sha: string;
  product_area: string;
  allowed_files: string[];
  allowed_modules: string[];
  forbidden_modules: string[];
  protected_contracts: string[];
  required_tests: string[];
  required_device_gates: string[];
  eas_allowed: boolean;
  play_allowed: boolean;
  production_allowed: boolean;
  push_allowed: boolean;
  max_eas_builds?: number;
  authorized_sha?: string | null;
  owner_status_claim?: string | null;
  device_evidence?: {
    device?: string;
    date?: string;
    notes?: string;
  } | null;
  notes?: string;
};

export type BaselineEntry = {
  feature_id: string;
  product_area: string;
  owner_status: OwnerStatus;
  accepted_sha: string | null;
  accepted_eas_build_id?: string | null;
  accepted_device?: string | null;
  accepted_date?: string | null;
  required_files: string[];
  protected_files: string[];
  regression_tests: string[];
  device_tests: string[];
  dependencies: string[];
  known_failure_signatures: string[];
  supersedes: string[];
  superseded_by: string | null;
  notes?: string;
};

export type WatchContract = {
  id: string;
  owner_status: OwnerStatus;
  last_known_accepted_evidence: string;
  reference_sha: string | null;
  reference_branch: string | null;
  regression_tests: string[];
  device_required: boolean;
  failure_signature: string | null;
  owning_files: string[];
  dependent_files: string[];
};

export type AreaDef = {
  globs: string[];
  depends_on: string[];
  expands_tests: string[];
  expands_contracts: string[];
};

export type GateResult = {
  ok: boolean;
  command: string;
  reasons: string[];
  details?: Record<string, unknown>;
};

export type GitPort = {
  head(): string;
  branch(): string;
  statusPorcelain(): string[];
  diffNames(from: string, to: string): string[];
  worktreeChanged(): string[];
};

export type BuildLedgerEntry = {
  task_id: string;
  authorized_sha: string;
  max_eas_builds: number;
  build_count: number;
  eas_build_ids: string[];
};

export type LockConfig = {
  baselines: { baselines: BaselineEntry[]; current_fold6_watch_status: string };
  contracts: { contracts: WatchContract[]; current_fold6_watch_status: string };
  graph: { areas: Record<string, AreaDef> };
  deviceRequired: { device_required_contract_ids: string[] };
  policy: { default_max_eas_builds: number };
  ledger: Record<string, BuildLedgerEntry>;
};
