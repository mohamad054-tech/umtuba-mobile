/**
 * Local-readable session times. Returns null when the timestamp is missing/invalid.
 */
export function formatLiveSessionTime(
  iso: string | null | undefined
): string | null {
  if (!iso || typeof iso !== "string") return null;
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  try {
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return date.toISOString();
  }
}

export function formatLiveViewerCount(count: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count < 0) return null;
  const n = Math.trunc(count);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M watching`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K watching`;
  return `${n} watching`;
}
