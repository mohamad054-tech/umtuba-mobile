import type { Href } from "expo-router";

/** Stable Discover card model — expandable without inventing backends. */
export type DiscoverCardModel = {
  id: string;
  title: string;
  subtitle: string | null;
  metadata: string | null;
  imageUrl: string | null;
  /** Safe in-app destination, or null when navigation is not allowed. */
  destination: Href | null;
  unavailable: boolean;
  source: "watch";
};

export type DiscoverCategoryId =
  | "watch"
  | "learning"
  | "games"
  | "live"
  | "communities"
  | "events";

export type DiscoverCategory = {
  id: DiscoverCategoryId;
  label: string;
  /** True only when a real in-app destination exists today. */
  supported: boolean;
  href: Href | null;
};

export type DiscoverSectionStatus =
  | "ready"
  | "empty"
  | "unavailable"
  | "error";

export type DiscoverSectionModel = {
  id: string;
  title: string;
  status: DiscoverSectionStatus;
  message: string | null;
  items: DiscoverCardModel[];
};

export type DiscoverHomeModel = {
  categories: DiscoverCategory[];
  trending: DiscoverSectionModel;
  latest: DiscoverSectionModel;
  recommended: DiscoverSectionModel;
  placeholders: DiscoverSectionModel[];
};

export type DiscoverLoadResult =
  | { ok: true; home: DiscoverHomeModel; cards: DiscoverCardModel[] }
  | {
      ok: false;
      message: string;
      unavailable?: boolean;
    };
