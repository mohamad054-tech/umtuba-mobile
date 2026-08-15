import { describe, expect, it } from "vitest";

import config from "../../../app.config";

describe("iOS App Store build config", () => {
  it("keeps the committed bundle identity and Team ID", () => {
    expect(config.ios?.bundleIdentifier).toBe("com.umtuba.app");
    expect(config.ios?.appleTeamId).toBe("M6HDH86Z55");
    expect(config.version).toBe("1.0.0");
    expect(config.ios?.buildNumber).toBe("1");
    expect(config.name).toBe("UMTUBA");
    expect(config.scheme).toBe("umtuba");
  });

  it("declares Universal Links hosts without inventing extra Apple IDs", () => {
    expect(config.ios?.associatedDomains).toEqual([
      "applinks:umtuba.com",
      "applinks:www.umtuba.com",
    ]);
    expect(config.ios?.config?.usesNonExemptEncryption).toBe(false);
  });

  it("does not declare unused camera or microphone usage strings", () => {
    const info = config.ios?.infoPlist ?? {};
    expect(info.NSCameraUsageDescription).toBeUndefined();
    expect(info.NSMicrophoneUsageDescription).toBeUndefined();
    expect(String(info.NSPhotoLibraryUsageDescription ?? "")).toMatch(
      /video to publish/i
    );
    const pluginNames = (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin
    );
    expect(pluginNames).not.toContain("expo-camera");
  });

  it("does not request unused Android CAMERA or RECORD_AUDIO", () => {
    const permissions = config.android?.permissions ?? [];
    expect(permissions).not.toContain("CAMERA");
    expect(permissions).not.toContain("RECORD_AUDIO");
    expect(permissions).not.toContain("android.permission.CAMERA");
    expect(permissions).not.toContain("android.permission.RECORD_AUDIO");
    const blocked = config.android?.blockedPermissions ?? [];
    expect(blocked).toEqual(
      expect.arrayContaining([
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
      ])
    );
    expect(config.android?.package).toBe("com.umtuba.app");
  });
});
