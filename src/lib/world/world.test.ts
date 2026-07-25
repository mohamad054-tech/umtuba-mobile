import { describe, expect, it } from "vitest";

import {
  canOpenWorldDestination,
  createDisabledWorldRendererAdapter,
  getWorldFoundationSnapshot,
  isWorldFoundationConfigured,
  isWorldRendererBound,
  listWorldCategories,
  mapWorldDestination,
  parseWorldAction,
  parseWorldCamera,
  parseWorldCategoryId,
  parseWorldEntity,
  parseWorldLayer,
  parseWorldLayerKind,
  parseWorldPin,
  parseWorldViewport,
} from "@/src/lib/world";

describe("world categories", () => {
  it("exposes expandable catalog and rejects unknown ids", () => {
    const all = listWorldCategories({ includeUnsupported: true });
    expect(all.map((c) => c.id)).toEqual([
      "users",
      "cities",
      "education",
      "games",
      "events",
      "businesses",
      "ai",
      "future",
    ]);
    expect(listWorldCategories()).toEqual([]);
    expect(parseWorldCategoryId("events")).toBe("events");
    expect(parseWorldCategoryId("planets")).toBeNull();
  });
});

describe("world camera / viewport", () => {
  it("parses valid camera and rejects invalid coords", () => {
    expect(
      parseWorldCamera({ latitude: 31.95, longitude: 35.91, zoom: 10 })
    ).toMatchObject({ latitude: 31.95, longitude: 35.91, zoom: 10 });
    expect(
      parseWorldCamera({ latitude: 200, longitude: 35, zoom: 5 })
    ).toBeNull();
    expect(parseWorldViewport({ north: 32, south: 31, east: 36, west: 35 })).toEqual({
      north: 32,
      south: 31,
      east: 36,
      west: 35,
    });
    expect(
      parseWorldViewport({ north: 30, south: 31, east: 36, west: 35 })
    ).toBeNull();
  });
});

describe("world layers / pins / entities", () => {
  it("accepts known layers and rejects unknown kinds", () => {
    expect(parseWorldLayerKind("pins")).toBe("pins");
    expect(parseWorldLayerKind("satellite-vendor")).toBeNull();
    expect(
      parseWorldLayer({
        id: "l1",
        kind: "pins",
        label: "Events",
        category: "events",
        visible: true,
        interactive: true,
        zIndex: 2,
      })
    ).toMatchObject({ id: "l1", kind: "pins", category: "events" });
    expect(
      parseWorldLayer({ id: "l2", kind: "mystery", label: "X" })
    ).toBeNull();
  });

  it("parses pins/entities and rejects unknowns", () => {
    expect(
      parseWorldPin({
        id: "p1",
        entity_id: "e1",
        latitude: 31.9,
        longitude: 35.9,
        category: "cities",
        title: "Amman",
      })
    ).toMatchObject({ id: "p1", category: "cities" });
    expect(
      parseWorldPin({
        id: "p2",
        entity_id: "e2",
        latitude: 31.9,
        longitude: 35.9,
        category: "nope",
      })
    ).toBeNull();
    expect(
      parseWorldEntity({
        id: "e1",
        kind: "event",
        category: "events",
        title: "Meetup",
      })
    ).toMatchObject({ id: "e1", kind: "event" });
    expect(
      parseWorldEntity({
        id: "e2",
        kind: "spaceship",
        category: "events",
        title: "X",
      })
    ).toBeNull();
  });
});

describe("world actions / destinations", () => {
  it("parses actions and maps safe destinations only", () => {
    expect(
      parseWorldAction({ kind: "navigate", target_id: "x" })
    ).toMatchObject({ kind: "navigate", targetId: "x" });
    expect(parseWorldAction({ kind: "explode" })).toBeNull();
    expect(mapWorldDestination("/(tabs)/discover")).toBe("/(tabs)/discover");
    expect(mapWorldDestination("/world")).toBe("/(tabs)/discover");
    expect(canOpenWorldDestination("https://evil.example/world")).toBe(false);
    expect(mapWorldDestination("https://umtuba.com/live")).toBe("/(tabs)/live");
  });
});

describe("world foundation snapshot", () => {
  it("is unavailable without fake data or bound renderer", () => {
    expect(isWorldFoundationConfigured()).toBe(false);
    expect(isWorldRendererBound()).toBe(false);
    const snap = getWorldFoundationSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(snap.layers).toEqual([]);
    expect(snap.camera).toBeNull();
    expect(snap.renderer.family).toBe("none");
    expect(createDisabledWorldRendererAdapter().id).toBe("world-renderer-none");
    expect(JSON.stringify(snap)).not.toMatch(/google|mapbox|cesium|pmtiles|maplibre/i);
  });
});
