import { describe, expect, it } from "vitest";

import {
  canOpenLiveDestination,
  formatLiveSessionTime,
  formatLiveViewerCount,
  isLiveJoinContractConfigured,
  isLiveLobbySourceConfigured,
  liveStatusLabel,
  loadLiveLobby,
  mapLiveDestination,
  parseLiveSession,
  parseLiveSessionStatus,
  parseLiveSessions,
  resolveLiveJoin,
} from "@/src/lib/live";

describe("live status parsing", () => {
  it("accepts known statuses and rejects unknown", () => {
    expect(parseLiveSessionStatus("live")).toBe("live");
    expect(parseLiveSessionStatus("SCHEDULED")).toBe("scheduled");
    expect(parseLiveSessionStatus("ended")).toBe("ended");
    expect(parseLiveSessionStatus("cancelled")).toBe("cancelled");
    expect(parseLiveSessionStatus("mystery")).toBeNull();
    expect(parseLiveSessionStatus("")).toBeNull();
    expect(liveStatusLabel("live")).toBe("LIVE");
  });
});

describe("parseLiveSession", () => {
  it("parses trusted fields without inventing missing values", () => {
    const session = parseLiveSession({
      id: "s1",
      title: "Creator Live",
      status: "live",
      host_display_name: "Ada",
      viewer_count: 12,
      starts_at: "2026-07-26T10:00:00.000Z",
      thumbnail_url: "https://cdn.example/t.jpg",
      join_eligible: true,
      destination: "/live/room-1",
    });

    expect(session).toMatchObject({
      id: "s1",
      title: "Creator Live",
      status: "live",
      hostDisplayName: "Ada",
      viewerCount: 12,
      joinEligible: true,
    });
    expect(session?.description).toBeNull();
  });

  it("rejects unknown status and missing title/id", () => {
    expect(
      parseLiveSession({ id: "s1", title: "X", status: "broadcasting" })
    ).toBeNull();
    expect(parseLiveSession({ title: "X", status: "live" })).toBeNull();
    expect(parseLiveSession({ id: "s1", status: "live" })).toBeNull();
  });

  it("does not mark joinEligible without a safe destination", () => {
    const session = parseLiveSession({
      id: "s1",
      title: "X",
      status: "live",
      join_eligible: true,
      destination: "https://evil.example/join",
    });
    expect(session?.joinEligible).toBe(false);
  });
});

describe("live destination safety", () => {
  it("maps lobby paths and rejects unsupported destinations", () => {
    expect(mapLiveDestination("/(tabs)/live")).toBe("/(tabs)/live");
    expect(mapLiveDestination("/live/room1")).toBe("/(tabs)/live");
    expect(canOpenLiveDestination("https://umtuba.com/live/abc")).toBe(true);
    expect(mapLiveDestination("https://evil.example/live")).toBeNull();
    expect(mapLiveDestination("/admin")).toBeNull();
  });
});

describe("resolveLiveJoin", () => {
  it("blocks join while no mobile join contract exists", () => {
    expect(isLiveJoinContractConfigured()).toBe(false);
    const session = parseLiveSession({
      id: "s1",
      title: "Live now",
      status: "live",
      join_eligible: true,
      destination: "/live/room-1",
    });
    expect(session).not.toBeNull();
    const decision = resolveLiveJoin(session!);
    expect(decision.canJoin).toBe(false);
    expect(decision.reason).toMatch(/not available/i);
    expect(decision.href).toBeNull();
  });
});

describe("loadLiveLobby", () => {
  it("fails closed as unavailable when no source is configured", async () => {
    expect(isLiveLobbySourceConfigured()).toBe(false);
    const result = await loadLiveLobby();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unavailable).toBe(true);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("returns empty list helper behavior via parseLiveSessions", () => {
    expect(parseLiveSessions([])).toEqual([]);
    expect(parseLiveSessions(null)).toEqual([]);
  });
});

describe("live formatting", () => {
  it("formats trusted times and viewer counts; skips invalid", () => {
    const label = formatLiveSessionTime("2026-07-26T15:30:00.000Z");
    expect(label).toBeTruthy();
    expect(formatLiveSessionTime("not-a-date")).toBeNull();
    expect(formatLiveSessionTime(null)).toBeNull();
    expect(formatLiveViewerCount(12)).toBe("12 watching");
    expect(formatLiveViewerCount(null)).toBeNull();
    expect(formatLiveViewerCount(-1)).toBeNull();
  });
});
