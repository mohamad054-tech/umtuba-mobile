import type { DiscoverHomeModel } from "@/src/lib/discover/types";
import type { DiscoverSearchPhase } from "@/src/lib/discover/search";

/**
 * Discover World / More chrome is independent of feed `home` load state.
 * Always available — including failed, empty, and active search surfaces.
 */
export function shouldShowDiscoverWorldEntry(_options?: {
  home?: DiscoverHomeModel | null;
  searchPhase?: DiscoverSearchPhase | "idle";
}): boolean {
  return true;
}
