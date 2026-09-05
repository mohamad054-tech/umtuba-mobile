import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cli = join(root, "src", "lib", "regressionLock", "cli.ts");
const result = spawnSync(
  process.execPath,
  ["--experimental-strip-types", "--no-warnings", cli, ...process.argv.slice(2)],
  { cwd: root, stdio: "inherit" }
);
process.exit(result.status ?? 1);
