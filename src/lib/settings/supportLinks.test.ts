import { describe, expect, it } from "vitest";

import {
  SUPPORT_LINKS,
  getSupportUrl,
  isAllowedSupportUrl,
  resolveSupportUrl,
} from "./supportLinks";

describe("settings account deletion + support link contracts", () => {
  it("exposes account deletion only as the Central web URL (no mobile backend)", () => {
    expect(getSupportUrl("accountDeletion")).toBe(
      "https://umtuba.com/account-deletion"
    );
    expect(SUPPORT_LINKS.accountDeletion).toBe(
      "https://umtuba.com/account-deletion"
    );
    expect(resolveSupportUrl(SUPPORT_LINKS.accountDeletion)).toBe(
      "https://umtuba.com/account-deletion"
    );
  });

  it("exposes Terms for settings and fails closed on unknown destinations", () => {
    expect(getSupportUrl("terms")).toBe("https://umtuba.com/terms");
    expect(isAllowedSupportUrl("https://umtuba.com/account-deletion")).toBe(
      true
    );
    expect(isAllowedSupportUrl("https://umtuba.com/admin")).toBe(false);
    expect(resolveSupportUrl("https://evil.example/account-deletion")).toBeNull();
    expect(resolveSupportUrl(null)).toBeNull();
  });
});
