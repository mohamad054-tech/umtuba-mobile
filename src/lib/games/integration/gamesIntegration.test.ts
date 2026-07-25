import { describe, expect, it } from "vitest";

import {
  getGamesIntegrationSnapshot,
  isGameLauncherBound,
  isGamesIntegrationAdapterBound,
  isGamesIntegrationConfigured,
  parseGameAvailabilityState,
  parseGameCatalogEntry,
  parseGameEntity,
  parseGameLaunchMode,
  parseGameSessionReference,
  resolveGameLaunchContract,
} from "@/src/lib/games/integration";

describe("games integration enums", () => {
  it("accepts known states/modes and rejects unknown", () => {
    expect(parseGameAvailabilityState("available")).toBe("available");
    expect(parseGameAvailabilityState("coming_soon")).toBe("coming_soon");
    expect(parseGameAvailabilityState("playing")).toBeNull();
    expect(parseGameLaunchMode("internal")).toBe("internal");
    expect(parseGameLaunchMode("steam")).toBeNull();
  });
});

describe("games catalog / entity parse", () => {
  it("parses trusted catalog entries without inventing ids", () => {
    const entry = parseGameCatalogEntry({
      game_id: "chess-v1",
      title: "UM Chess",
      state: "available",
      launch_mode: "internal",
      destination: "/discover",
    });
    expect(entry).toMatchObject({
      gameId: "chess-v1",
      title: "UM Chess",
      state: "available",
    });
    expect(entry?.destination?.href).toBe("/(tabs)/discover");
    expect(parseGameCatalogEntry({ title: "X", state: "available" })).toBeNull();
  });

  it("requires platform game entity fields", () => {
    const game = parseGameEntity({
      id: "g1",
      type: "game",
      title: "Arena",
      visibility: "public",
      ownership: "system",
      module: "games",
      game_id: "arena-1",
      state: "coming_soon",
      capabilities: ["leaderboards", "friends"],
    });
    expect(game?.gameId).toBe("arena-1");
    expect(game?.platformEntity.type).toBe("game");
    expect(game?.capabilities).toEqual(["leaderboards", "friends"]);
    expect(
      parseGameEntity({
        id: "g2",
        type: "video",
        title: "Not a game",
        visibility: "public",
        ownership: "self",
        state: "available",
        game_id: "x",
      })
    ).toBeNull();
  });
});

describe("safe launch contract", () => {
  it("never enables launch in foundation and rejects unsafe destinations", () => {
    expect(isGameLauncherBound()).toBe(false);
    const okShape = resolveGameLaunchContract({
      gameId: "chess-v1",
      mode: "internal",
      state: "available",
      destinationRaw: "/(tabs)/discover",
    });
    expect(okShape?.canLaunch).toBe(false);
    expect(okShape?.reason).toMatch(/not available/i);
    expect(okShape?.destination?.href).toBe("/(tabs)/discover");

    const blocked = resolveGameLaunchContract({
      gameId: "chess-v1",
      mode: "internal",
      state: "maintenance",
      destinationRaw: "/(tabs)/discover",
    });
    expect(blocked?.canLaunch).toBe(false);

    const unsafe = resolveGameLaunchContract({
      gameId: "chess-v1",
      mode: "external",
      state: "available",
      destinationRaw: "https://evil.example/play",
    });
    expect(unsafe?.canLaunch).toBe(false);
    expect(unsafe?.destination?.href).toBeNull();
  });
});

describe("references / foundation snapshot", () => {
  it("parses session refs and stays empty/unavailable", () => {
    expect(
      parseGameSessionReference({
        session_id: "s1",
        game_id: "chess-v1",
        started_at: "2026-07-26T01:00:00.000Z",
      })
    ).toMatchObject({ sessionId: "s1", gameId: "chess-v1" });
    expect(parseGameSessionReference({ game_id: "x" })).toBeNull();

    expect(isGamesIntegrationConfigured()).toBe(false);
    expect(isGamesIntegrationAdapterBound()).toBe(false);
    const snap = getGamesIntegrationSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(snap.catalog).toEqual([]);
    expect(snap.capabilities.every((c) => c.enabled === false)).toBe(true);
  });
});
