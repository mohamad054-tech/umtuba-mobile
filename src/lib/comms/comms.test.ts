import { describe, expect, it } from "vitest";

import {
  buildPersonalAtPath,
  buildPersonalContactPath,
  buildPersonalContactUrl,
  isSafeContactUrlPayload,
  parsePersonalContactInput,
} from "./contactLink";
import { commsCopyForRtl } from "./copy";
import { normalizeDiscoveryEmail } from "./emailIdentity";
import {
  composeE164,
  inferCountryCodeFromE164,
  normalizeE164Input,
} from "./phoneIdentity";
import {
  DEFAULT_EMAIL_FIND,
  DEFAULT_PHONE_FIND,
  effectivePhoneFind,
} from "./privacyContract";
import { encodeContactQrModules, renderContactQrSvg } from "./qrModules";

describe("personal contact link", () => {
  it("builds username paths without private ids", () => {
    expect(buildPersonalContactPath("@Ada.User")).toBe("/u/ada.user");
    expect(buildPersonalAtPath("Ada.User")).toBe("/@ada.user");
    expect(buildPersonalContactUrl("ada.user")).toBe(
      "https://umtuba.com/@ada.user"
    );
    expect(buildPersonalContactPath("ab")).toBeNull();
  });

  it("parses @handle, /u/handle, and absolute URLs", () => {
    expect(parsePersonalContactInput("@maya")).toEqual({ username: "maya" });
    expect(parsePersonalContactInput("/u/maya")).toEqual({ username: "maya" });
    expect(parsePersonalContactInput("https://umtuba.com/@maya")).toEqual({
      username: "maya",
    });
    expect(parsePersonalContactInput("umtuba://@maya")).toEqual({
      username: "maya",
    });
    expect(parsePersonalContactInput("not a handle!")).toBeNull();
  });
});

describe("email and phone identity", () => {
  it("normalizes emails without exposing them as public identity", () => {
    expect(normalizeDiscoveryEmail("  Ada@Example.COM ")).toBe(
      "ada@example.com"
    );
    expect(normalizeDiscoveryEmail("nope")).toBeNull();
  });

  it("composes E.164 and treats contacts-mode as nobody", () => {
    expect(composeE164("+1", "2025550123")).toBe("+12025550123");
    expect(normalizeE164Input("+44 7700 900123")).toBe("+447700900123");
    expect(inferCountryCodeFromE164("+12025550123")).toBe("+1");
    expect(DEFAULT_EMAIL_FIND).toBe("nobody");
    expect(DEFAULT_PHONE_FIND).toBe("nobody");
    expect(effectivePhoneFind("contacts")).toBe("nobody");
    expect(effectivePhoneFind("everyone")).toBe("everyone");
  });
});

describe("contact QR payload", () => {
  it("encodes only the personal contact URL", () => {
    const url = "https://umtuba.com/@ada.user";
    expect(isSafeContactUrlPayload(url)).toBe(true);
    const modules = encodeContactQrModules(url);
    expect(modules.length).toBeGreaterThan(20);
    const svg = renderContactQrSvg(url);
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/\+[1-9][0-9]{7,14}/);
    expect(svg).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(svg).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
  });
});

describe("comms copy", () => {
  it("uses Arabic when RTL and English when LTR", () => {
    expect(commsCopyForRtl(true).startConversation).toBe("بدء محادثة");
    expect(commsCopyForRtl(false).startConversation).toBe("Start conversation");
  });
});
