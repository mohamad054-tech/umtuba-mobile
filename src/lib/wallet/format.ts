/** Compact balance formatting for wallet pills and rewards UI. */

export function formatWalletAmount(
  amount: number,
  decimals: number = 0
): string {
  if (!Number.isFinite(amount)) {
    return "0";
  }

  const safe = Math.max(0, amount);

  if (decimals > 0) {
    return safe.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    });
  }

  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (safe >= 10_000) {
    return `${Math.round(safe / 1000)}K`;
  }
  if (safe >= 1000) {
    return `${(safe / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return String(Math.round(safe));
}

export function formatWalletAmountExact(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return Math.max(0, Math.round(amount)).toLocaleString();
}
