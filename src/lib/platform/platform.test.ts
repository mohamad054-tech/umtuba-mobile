import { describe, expect, it } from "vitest";

import {
  canOpenPlatformDestination,
  getPlatformFoundationSnapshot,
  hasPlatformPermission,
  isPlatformAdapterBound,
  isPlatformFoundationConfigured,
  listPlatformModules,
  mapPlatformDestination,
  parsePlatformAction,
  parsePlatformActionId,
  parsePlatformEntity,
  parsePlatformEntityType,
  parsePlatformOwnership,
  parsePlatformPermission,
  parsePlatformPermissionId,
  parsePlatformVisibility,
} from "@/src/lib/platform";

describe("platform enums", () => {
  it("accepts known ids and rejects unknown", () => {
    expect(parsePlatformEntityType("video")).toBe("video");
    expect(parsePlatformEntityType("wallet")).toBe("wallet");
    expect(parsePlatformEntityType("transaction")).toBe("transaction");
    expect(parsePlatformEntityType("spaceship")).toBeNull();
    expect(parsePlatformActionId("join")).toBe("join");
    expect(parsePlatformActionId("explode")).toBeNull();
    expect(parsePlatformPermissionId("moderate")).toBe("moderate");
    expect(parsePlatformPermissionId("sudo")).toBeNull();
    expect(parsePlatformVisibility("followers")).toBe("followers");
    expect(parsePlatformVisibility("secret")).toBeNull();
    expect(parsePlatformOwnership("self")).toBe("self");
    expect(parsePlatformOwnership("alien")).toBeNull();
  });
});

describe("platform entity / action parse", () => {
  it("parses trusted entities and fails closed on gaps", () => {
    const entity = parsePlatformEntity({
      id: "v1",
      type: "video",
      title: "Clip",
      visibility: "public",
      ownership: "self",
      module: "watch",
      destination: "/(tabs)/watch?post=12",
      metadata: { postId: 12 },
    });
    expect(entity).toMatchObject({
      id: "v1",
      type: "video",
      title: "Clip",
    });
    expect(entity?.destination?.href).toBe("/(tabs)/watch?post=12");

    expect(
      parsePlatformEntity({
        id: "x",
        type: "unknown-type",
        title: "X",
        visibility: "public",
        ownership: "self",
      })
    ).toBeNull();

    expect(
      parsePlatformAction({
        id: "open",
        enabled: true,
        destination: "/notifications",
      })
    ).toMatchObject({
      id: "open",
      enabled: true,
      destination: { href: "/notifications" },
    });
    expect(parsePlatformAction({ id: "teleport", enabled: true })).toBeNull();
  });
});

describe("platform destinations", () => {
  it("allowlists official routes only", () => {
    expect(mapPlatformDestination("/(tabs)/messages")).toBe("/(tabs)/messages");
    expect(mapPlatformDestination("/world")).toBe("/world");
    expect(mapPlatformDestination("/(tabs)/world")).toBe("/world");
    expect(
      canOpenPlatformDestination("https://umtuba.com/rewards")
    ).toBe(true);
    expect(mapPlatformDestination("https://evil.example/watch")).toBeNull();
    expect(mapPlatformDestination("/admin")).toBeNull();
  });
});

describe("platform permissions / foundation", () => {
  it("checks grants and stays unavailable without adapters/data", () => {
    expect(
      hasPlatformPermission(
        [{ id: "view", granted: true }],
        "view"
      )
    ).toBe(true);
    expect(
      parsePlatformPermission({ id: "admin", granted: false })
    ).toEqual({ id: "admin", granted: false });
    expect(parsePlatformPermission({ id: "root", granted: true })).toBeNull();

    expect(isPlatformFoundationConfigured()).toBe(false);
    expect(isPlatformAdapterBound()).toBe(false);
    const snap = getPlatformFoundationSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(snap.context.userId).toBeNull();
    expect(listPlatformModules({ availableOnly: true }).map((m) => m.id)).toEqual(
      expect.arrayContaining([
        "watch",
        "discover",
        "messages",
        "live",
        "notifications",
      ])
    );
    expect(JSON.stringify(snap)).not.toMatch(/sample|fake|demo entity/i);
  });
});
