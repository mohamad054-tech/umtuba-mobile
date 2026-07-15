/** Dark theme tokens aligned with umtuba-web Watch / Discover surfaces. */
export const colors = {
  bg: "#050510",
  surface: "#080816",
  surfaceElevated: "#0c0c1a",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.55)",
  textSubtle: "rgba(255,255,255,0.35)",
  accentViolet: "#8b5cf6",
  accentCyan: "#22d3ee",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  danger: "#f87171",
  success: "#34d399",
  overlay: "rgba(5,5,16,0.72)",
} as const;

export type ThemeColors = typeof colors;
