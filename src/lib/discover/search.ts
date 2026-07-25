import type { DiscoverCardModel } from "@/src/lib/discover/types";

/**
 * Client-side Discover search over already-loaded cards only.
 * No server search API — never invents results.
 */
export function filterDiscoverCards(
  cards: DiscoverCardModel[],
  query: string
): DiscoverCardModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return cards.filter((card) => {
    const hay = [card.title, card.subtitle, card.metadata]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export type DiscoverSearchPhase =
  | "idle"
  | "loading"
  | "empty"
  | "error"
  | "results";

export function resolveDiscoverSearchPhase(input: {
  query: string;
  loading: boolean;
  error: string | null;
  resultCount: number;
}): DiscoverSearchPhase {
  const q = input.query.trim();
  if (!q) return "idle";
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (input.resultCount === 0) return "empty";
  return "results";
}
