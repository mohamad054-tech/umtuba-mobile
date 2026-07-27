import {
  formatWorldCommerceKindLabel,
  type WorldCommerceRecord,
} from "@/src/lib/world/commerce/types";

export type WorldCommerceSheetActionId = "open_store";

export type WorldCommerceSheetAction = {
  id: WorldCommerceSheetActionId;
  label: string;
  enabled: boolean;
  placeholder: string;
};

export type WorldCommerceSheetMetaId = "products" | "rating" | "open_status";

export type WorldCommerceSheetMeta = {
  id: WorldCommerceSheetMetaId;
  label: string;
  value: string | null;
  placeholder: string;
};

export type WorldCommerceSheetState = {
  commerceId: string;
  name: string;
  commerceTypeLabel: string;
  cityName: string;
  brandName: string | null;
  open: boolean;
  meta: WorldCommerceSheetMeta[];
  actions: WorldCommerceSheetAction[];
};

const PLACEHOLDER_META: WorldCommerceSheetMeta[] = [
  { id: "products", label: "Products", value: null, placeholder: "Coming soon" },
  { id: "rating", label: "Rating", value: null, placeholder: "Coming soon" },
  { id: "open_status", label: "Open status", value: null, placeholder: "Coming soon" },
];

const PLACEHOLDER_ACTIONS: WorldCommerceSheetAction[] = [
  {
    id: "open_store",
    label: "Open Store",
    enabled: false,
    placeholder: "Coming soon",
  },
];

export function buildWorldCommerceSheetState(
  record: WorldCommerceRecord | null,
  open: boolean
): WorldCommerceSheetState | null {
  if (!record || !open) return null;
  return {
    commerceId: record.id,
    name: record.name,
    commerceTypeLabel: formatWorldCommerceKindLabel(record.commerceType),
    cityName: record.cityName,
    brandName: record.brandName,
    open: true,
    meta: PLACEHOLDER_META.map((m) => ({ ...m })),
    actions: PLACEHOLDER_ACTIONS.map((a) => ({ ...a })),
  };
}
