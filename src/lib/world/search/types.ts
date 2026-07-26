/**
 * World Search & Discovery — in-memory search over Pipeline-backed domain data.
 * No external search APIs / MapLibre / UI imports.
 */

export type WorldSearchSourceType = "places" | "education" | "users";

export type WorldSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  /** Human-readable kind label (e.g. Capital, University, User). */
  kind: string;
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
  sourceType: WorldSearchSourceType;
};

export type WorldSearchDataset = {
  places: import("@/src/lib/world/places").WorldPlace[];
  education: import("@/src/lib/world/dataPipeline").WorldEducationRecord[];
  users: import("@/src/lib/world/dataPipeline").WorldUserRecord[];
};

export type WorldSearchService = {
  /**
   * Search Places + Education + Users from a Pipeline-backed dataset.
   * Empty / whitespace query → []. Fail-closed on bad input.
   */
  search(
    query: string,
    dataset: WorldSearchDataset,
    options?: { limit?: number }
  ): WorldSearchResult[];
};

export const WORLD_SEARCH_DEFAULT_LIMIT = 20;
