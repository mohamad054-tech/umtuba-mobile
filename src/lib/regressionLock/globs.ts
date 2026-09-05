export function normalizeRepoPath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function matchGlob(file: string, glob: string): boolean {
  const n = normalizeRepoPath(file);
  const g = normalizeRepoPath(glob);
  if (g === "**" || g === "**/*") return true;
  if (g.endsWith("/**")) {
    const prefix = g.slice(0, -3);
    return n === prefix || n.startsWith(`${prefix}/`);
  }
  if (g.includes("**")) {
    const [head, tail] = g.split("/**");
    const suffix = (tail ?? "").replace(/^\//, "");
    if (!n.startsWith(head.endsWith("/") ? head : head)) return false;
    if (!suffix) return n.startsWith(head);
    if (suffix.includes("*")) {
      return matchGlob(n.slice(head.length).replace(/^\//, ""), suffix);
    }
    return n.endsWith(suffix) || n.includes(`/${suffix}`) || n === `${head}/${suffix}`;
  }
  if (g.includes("*")) {
    const escaped = g
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}$`).test(n);
  }
  return n === g;
}

export function matchesAny(file: string, globs: string[]): boolean {
  const path = normalizeRepoPath(file);
  if (path.endsWith("/")) {
    const prefix = path.slice(0, -1);
    return globs.some((glob) => {
      const g = normalizeRepoPath(glob);
      return g === prefix || g.startsWith(`${prefix}/`) || matchGlob(`${prefix}/placeholder`, g);
    });
  }
  return globs.some((glob) => matchGlob(path, glob));
}

export function parseGitStatusPath(line: string): string | null {
  const raw = line.replace(/\r/g, "").trimEnd();
  if (!raw) return null;
  const renamed = raw.match(/^[R][ M]\s+.+\s+->\s+(.+)$/);
  if (renamed?.[1]) return normalizeRepoPath(renamed[1]);
  if (raw.length >= 4 && raw[2] === " ") {
    return normalizeRepoPath(raw.slice(3));
  }
  const stripped = raw.replace(/^[ ?MADRCU]{1,2}\s+/, "");
  return stripped ? normalizeRepoPath(stripped) : null;
}
