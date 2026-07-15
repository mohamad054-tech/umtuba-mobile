/**
 * Application-layer wallet / digital asset model.
 * UM Points is the primary asset on mobile V1.
 */

export type AssetId = "um_points" | "umtuba_token";

export type AssetKind = "points" | "token";

export type WalletAssetDefinition = {
  id: AssetId;
  kind: AssetKind;
  symbol: string;
  displayName: string;
  accent: "violet" | "cyan" | "amber";
  href: string;
  decimals: number;
  conversionReady: boolean;
};

export type WalletBalanceStatus =
  | "loading"
  | "signed_out"
  | "ready"
  | "error";

export type WalletBalance = {
  assetId: AssetId;
  amount: number;
  updatedAt: string | null;
};

export type WalletBalanceState = {
  status: WalletBalanceStatus;
  balance: WalletBalance | null;
  errorMessage: string | null;
};

export const WALLET_ASSETS: Record<AssetId, WalletAssetDefinition> = {
  um_points: {
    id: "um_points",
    kind: "points",
    symbol: "UM",
    displayName: "UM Points",
    accent: "violet",
    href: "/rewards",
    decimals: 0,
    conversionReady: false,
  },
  umtuba_token: {
    id: "umtuba_token",
    kind: "token",
    symbol: "UMT",
    displayName: "UMTUBA Token",
    accent: "cyan",
    href: "/rewards",
    decimals: 6,
    conversionReady: false,
  },
};

/** Primary header wallet asset (today: UM Points). */
export const PRIMARY_WALLET_ASSET_ID: AssetId = "um_points";

export function getPrimaryWalletAsset(): WalletAssetDefinition {
  return WALLET_ASSETS[PRIMARY_WALLET_ASSET_ID];
}
