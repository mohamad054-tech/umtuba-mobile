/**
 * Watch original-sound chip → root-stack `/sound/[id]?from=watch`.
 * Back must pop the live Watch instance, not replace `/(tabs)/watch`.
 * Create is a tab — never put `from=watch` on "Use this sound".
 */

export const WATCH_SOUND_ORIGIN = "watch" as const;

export function buildWatchSoundHref(soundId: string): string | null {
  const id = soundId.trim();
  if (!id) return null;
  return `/sound/${encodeURIComponent(id)}?from=${WATCH_SOUND_ORIGIN}`;
}

export function isWatchSoundPath(
  path: string,
  segments?: readonly string[]
): boolean {
  const leaf = (segments ?? path.split("/").filter(Boolean))
    .filter((part) => !part.startsWith("("))
    .join("/")
    .split("?")[0];
  if (leaf.startsWith("sound/") && leaf.split("/").length === 2) {
    return true;
  }
  const noQuery = path.trim().split("#")[0]?.split("?")[0] ?? "";
  const n = (noQuery.startsWith("/") ? noQuery : `/${noQuery}`)
    .replace(/\/+$/, "")
    .replace(/\/\([^/]+\)/g, "");
  return /^\/sound\/[^/]+$/.test(n || "/");
}

export function parseWatchSoundOrigin(
  raw: string | string[] | null | undefined
): typeof WATCH_SOUND_ORIGIN | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  return value === WATCH_SOUND_ORIGIN ? WATCH_SOUND_ORIGIN : null;
}
