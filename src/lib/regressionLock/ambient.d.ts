declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(
    path: string,
    opts?: { recursive?: boolean }
  ): void;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
}

declare module "node:child_process" {
  export function spawnSync(
    cmd: string,
    args?: string[],
    opts?: {
      cwd?: string;
      encoding?: string;
      windowsHide?: boolean;
      stdio?: string;
      shell?: boolean;
    }
  ): { stdout?: string; status?: number | null };
}
