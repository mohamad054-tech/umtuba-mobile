import type { Href } from "expo-router";

import type {
  DiscoverCategory,
  DiscoverCategoryId,
} from "@/src/lib/discover/types";

const CATEGORY_CATALOG: DiscoverCategory[] = [
  {
    id: "watch",
    label: "Watch",
    supported: true,
    href: "/(tabs)/watch",
  },
  {
    id: "live",
    label: "Live",
    supported: true,
    href: "/(tabs)/live",
  },
  {
    id: "learning",
    label: "Learning",
    supported: false,
    href: null,
  },
  {
    id: "games",
    label: "Games",
    supported: false,
    href: null,
  },
  {
    id: "communities",
    label: "Communities",
    supported: false,
    href: null,
  },
  {
    id: "events",
    label: "Events",
    supported: false,
    href: null,
  },
];

/**
 * Full expandable catalog. By default only supported categories are returned
 * for display (fail-closed for unsupported surfaces).
 */
export function getDiscoverCategories(options?: {
  includeUnsupported?: boolean;
}): DiscoverCategory[] {
  if (options?.includeUnsupported) {
    return CATEGORY_CATALOG.map((c) => ({ ...c }));
  }
  return CATEGORY_CATALOG.filter((c) => c.supported).map((c) => ({ ...c }));
}

export function getDiscoverCategory(
  id: DiscoverCategoryId
): DiscoverCategory | null {
  return CATEGORY_CATALOG.find((c) => c.id === id) ?? null;
}

export function isSupportedDiscoverCategory(id: string): boolean {
  const found = CATEGORY_CATALOG.find((c) => c.id === id);
  return Boolean(found?.supported);
}

/** Safe category navigation — unsupported ids never return a route. */
export function mapDiscoverCategoryHref(id: string): Href | null {
  const found = CATEGORY_CATALOG.find((c) => c.id === id);
  if (!found?.supported || !found.href) return null;
  return found.href;
}
