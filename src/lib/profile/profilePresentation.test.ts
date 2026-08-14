import { describe, expect, it } from "vitest";

import { buildProfilePresentation } from "@/src/lib/profile/presentation";
import {
  formatBuildLabel,
  resolveAppInfo,
} from "@/src/lib/settings/appInfo";
import {
  getSupportUrl,
  isAllowedSupportUrl,
  resolveSupportUrl,
} from "@/src/lib/settings/supportLinks";

describe("buildProfilePresentation", () => {
  it("does not invent placeholder identity when profile is missing", () => {
    const view = buildProfilePresentation(null, {
      id: "u1",
      email: "sam@example.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "",
    } as never);

    expect(view.displayName).toBeNull();
    expect(view.username).toBeNull();
    expect(view.email).toBe("sam@example.com");
    expect(view.hasReliableIdentity).toBe(true);
    expect(view.avatarInitial).toBe("?");
  });

  it("uses profile fields when present", () => {
    const view = buildProfilePresentation(
      {
        id: "u1",
        username: "sam",
        display_name: "Sam Lee",
        full_name: "Sam Lee",
        bio: "Hello",
        city: "Amman",
        country: "JO",
        avatar_url: "https://cdn.example/a.png",
        avatar_initial: "S",
      },
      { id: "u1", email: "sam@example.com" } as never
    );

    expect(view.displayName).toBe("Sam Lee");
    expect(view.username).toBe("sam");
    expect(view.bio).toBe("Hello");
    expect(view.locationLine).toBe("Amman, JO");
    expect(view.avatarUrl).toBe("https://cdn.example/a.png");
    expect(view.avatarInitial).toBe("S");
    expect(view.hasReliableIdentity).toBe(true);
  });

  it("rejects non-http avatar urls", () => {
    const view = buildProfilePresentation(
      {
        id: "u1",
        username: "sam",
        display_name: "Sam",
        full_name: "Sam",
        bio: null,
        city: null,
        country: null,
        avatar_url: "javascript:alert(1)",
        avatar_initial: "S",
      },
      null
    );
    expect(view.avatarUrl).toBeNull();
  });

  it("marks identity unreliable when nothing trustworthy exists", () => {
    const view = buildProfilePresentation(null, null);
    expect(view.hasReliableIdentity).toBe(false);
    expect(view.email).toBeNull();
  });
});

describe("supportLinks", () => {
  it("allowlists known UMTUBA public pages only", () => {
    expect(getSupportUrl("privacy")).toBe("https://umtuba.com/privacy");
    expect(getSupportUrl("support")).toBe("https://umtuba.com/privacy");
    expect(getSupportUrl("help")).toBe("https://umtuba.com/privacy");
    expect(getSupportUrl("accountDeletion")).toBe(
      "https://umtuba.com/account-deletion"
    );
    expect(resolveSupportUrl("https://umtuba.com/terms")).toBe(
      "https://umtuba.com/terms"
    );
    expect(isAllowedSupportUrl("https://evil.example")).toBe(false);
    expect(resolveSupportUrl("https://umtuba.com/admin")).toBeNull();
  });
});

describe("resolveAppInfo", () => {
  it("exposes version and build without secrets", () => {
    const info = resolveAppInfo(
      {
        expoConfig: {
          name: "UMTUBA",
          version: "1.0.0",
          android: { versionCode: 1 },
          ios: { buildNumber: "1" },
        },
        nativeAppVersion: "1.0.0",
        appOwnership: "standalone",
        executionEnvironment: "standalone",
      },
      "android"
    );

    expect(info.appVersion).toBe("1.0.0");
    expect(info.androidVersionCode).toBe("1");
    expect(formatBuildLabel(info)).toBe("1");
    expect(JSON.stringify(info)).not.toMatch(/supabase|service.?role|key/i);
  });
});
