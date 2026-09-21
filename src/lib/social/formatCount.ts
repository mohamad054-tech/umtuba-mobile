/**
 * Compact interaction counts, same rules as umtuba-web
 * `formatInteractionCount` (1.2K / 2.5M).
 */
export function formatInteractionCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  const n = Math.floor(value);
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(n);
}
