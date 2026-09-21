import { describe, expect, it } from "vitest";

import {
  pushFriendlyAskStorageKey,
  shouldExplainPushPermission,
} from "./permissionPrompt";

describe("shouldExplainPushPermission", () => {
  it("asks once after login on Android 13+ while still undetermined", () => {
    expect(
      shouldExplainPushPermission({
        os: "android",
        osVersion: 33,
        permission: "undetermined",
        alreadyAsked: false,
      })
    ).toBe(true);
  });

  it("does not ask on older Android, iOS, or after the first explanation", () => {
    expect(
      shouldExplainPushPermission({
        os: "android",
        osVersion: 32,
        permission: "undetermined",
        alreadyAsked: false,
      })
    ).toBe(false);
    expect(
      shouldExplainPushPermission({
        os: "ios",
        osVersion: 17,
        permission: "undetermined",
        alreadyAsked: false,
      })
    ).toBe(false);
    expect(
      shouldExplainPushPermission({
        os: "android",
        osVersion: 34,
        permission: "undetermined",
        alreadyAsked: true,
      })
    ).toBe(false);
    expect(
      shouldExplainPushPermission({
        os: "android",
        osVersion: 34,
        permission: "granted",
        alreadyAsked: false,
      })
    ).toBe(false);
  });

  it("scopes the once-flag to the signed-in account", () => {
    expect(pushFriendlyAskStorageKey("user-1")).toBe(
      "umtuba.push.friendly-ask.user-1"
    );
  });
});
