import { describe, expect, it } from "vitest";

import config from "../../../app.config";
import eas from "../../../eas.json";

describe("iOS App Store build config", () => {
  it("keeps the committed bundle identity and Team ID", () => {
    expect(config.ios?.bundleIdentifier).toBe("com.umtuba.app");
    expect(config.ios?.appleTeamId).toBe("M6HDH86Z55");
    expect(config.version).toBe("1.0.0");
    expect(config.ios?.supportsTablet).toBe(false);
    expect(config.ios?.buildNumber).toBe("20");
    expect(config.name).toBe("UMTUBA");
    expect(config.scheme).toBe("umtuba");
    expect(eas.submit.production.ios.appleTeamId).toBe("M6HDH86Z55");
    expect(eas.build.production.autoIncrement).toBe(true);
  });

  it("keeps preview as internal device IPA (not simulator)", () => {
    expect(eas.build.preview.distribution).toBe("internal");
    expect(eas.build.preview.ios.simulator).toBe(false);
    expect("autoIncrement" in eas.build.preview).toBe(false);
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

  it("declares a truthful location purpose string without expo-location", () => {
    const info = config.ios?.infoPlist ?? {};
    const purpose = String(info.NSLocationWhenInUseUsageDescription ?? "");
    expect(purpose).toMatch(/map library/i);
    expect(purpose).toMatch(/does not use your location/i);
    expect(purpose).not.toMatch(/nearby/i);
    expect(info.NSLocationAlwaysUsageDescription).toBeUndefined();
    expect(info.NSLocationAlwaysAndWhenInUseUsageDescription).toBeUndefined();
    const pluginNames = (config.plugins ?? []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin
    );
    expect(pluginNames).toContain("@maplibre/maplibre-react-native");
    expect(pluginNames).not.toContain("expo-location");
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
    expect(config.android?.versionCode).toBe(20);
  });
});
