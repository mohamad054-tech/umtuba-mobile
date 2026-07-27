import type { WorldCategoryId } from "@/src/lib/world/types";

export type WorldCategoryDefinition = {
  id: WorldCategoryId;
  label: string;
  /** True only when a trusted product surface exists in-app today. */
  supported: boolean;
};

/** Product layer order: Places → Education → Users → Games → Commerce → Events. */
const CATEGORY_CATALOG: WorldCategoryDefinition[] = [
  { id: "cities", label: "Places", supported: true },
  { id: "education", label: "Education", supported: true },
  { id: "users", label: "Users", supported: true },
  { id: "games", label: "Games", supported: true },
  { id: "businesses", label: "Commerce", supported: true },
  { id: "events", label: "Events", supported: true },
  { id: "ai", label: "AI", supported: false },
  { id: "future", label: "Future", supported: false },
];

export function listWorldCategories(options?: {
  includeUnsupported?: boolean;
}): WorldCategoryDefinition[] {
  if (options?.includeUnsupported) {
    return CATEGORY_CATALOG.map((c) => ({ ...c }));
  }
  return CATEGORY_CATALOG.filter((c) => c.supported).map((c) => ({ ...c }));
}

export function parseWorldCategoryId(
  raw: string | null | undefined
): WorldCategoryId | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  const found = CATEGORY_CATALOG.find((c) => c.id === key);
  return found?.id ?? null;
}

export function isKnownWorldCategory(raw: string | null | undefined): boolean {
  return parseWorldCategoryId(raw) != null;
}
