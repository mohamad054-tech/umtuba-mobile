import type { Href } from "expo-router";

/** Bounded Live session statuses — unknown values must not pass through. */
export type LiveSessionStatus =
  | "scheduled"
  | "live"
  | "ended"
  | "cancelled"
  | "unavailable";

export type LiveSession = {
  id: string;
  title: string;
  description: string | null;
  hostDisplayName: string | null;
  thumbnailUrl: string | null;
  avatarUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: LiveSessionStatus;
  /** Only set when a trusted count is present. */
  viewerCount: number | null;
  /** True only when backend explicitly allows join AND destination is safe. */
  joinEligible: boolean;
  /** Raw destination metadata from a trusted source (never invented). */
  destination: string | null;
};

export type LiveLobbyPhase =
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "error";

export type LiveLoadResult =
  | { ok: true; sessions: LiveSession[] }
  | {
      ok: false;
      message: string;
      unavailable?: boolean;
    };

export type LiveJoinDecision = {
  canJoin: boolean;
  reason: string | null;
  href: Href | null;
};
