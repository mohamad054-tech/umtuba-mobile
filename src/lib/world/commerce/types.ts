import type {
  WorldCommerceKind,
  WorldCommerceRecord,
} from "@/src/lib/world/dataPipeline/types";

export type { WorldCommerceKind, WorldCommerceRecord };

export const WORLD_COMMERCE_LAYER_ID = "businesses" as const;
export const WORLD_COMMERCE_LAYER_REF = "world-commerce-layer" as const;
export const COMMERCE_CLUSTER_MAX_ZOOM = 5.7;
export const COMMERCE_FOCUS_ZOOM = 6.3;

const COMMERCE_KINDS = new Set<WorldCommerceKind>([
  "store",
  "restaurant",
  "market",
  "service",
  "seller_hub",
]);

export function formatWorldCommerceKindLabel(
  commerceType: WorldCommerceKind
): string {
  switch (commerceType) {
    case "store":
      return "Store";
    case "restaurant":
      return "Restaurant";
    case "market":
      return "Market";
    case "service":
      return "Service";
    case "seller_hub":
      return "Seller Hub";
    default:
      return "Business";
  }
}

function looksLikeEmailOrPhone(value: string): boolean {
  if (value.includes("@")) return true;
  if (/\d{6,}/.test(value)) return true;
  return false;
}

export function normalizeWorldCommerceRecord(
  raw: WorldCommerceRecord
): WorldCommerceRecord | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (raw.published !== true) return null;
  if (raw.mapVisible !== true) return null;

  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim()
      : typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : null;
  if (!name) return null;

  const commerceType = raw.commerceType;
  if (!COMMERCE_KINDS.has(commerceType)) return null;

  const cityName =
    typeof raw.cityName === "string" && raw.cityName.trim().length > 0
      ? raw.cityName.trim()
      : null;
  if (!cityName) return null;

  let brandName: string | null = null;
  if (typeof raw.brandName === "string" && raw.brandName.trim().length > 0) {
    const trimmed = raw.brandName.trim();
    if (looksLikeEmailOrPhone(trimmed)) return null;
    brandName = trimmed;
  }

  const latitude =
    typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
      ? raw.latitude
      : null;
  const longitude =
    typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
      ? raw.longitude
      : null;

  return {
    id: raw.id.trim(),
    name,
    commerceType,
    cityName,
    brandName,
    latitude,
    longitude,
    mapVisible: true,
    published: true,
  };
}
