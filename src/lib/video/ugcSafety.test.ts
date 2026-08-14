import { describe, expect, it } from "vitest";

import {
  getSupportUrl,
  isAllowedSupportUrl,
  resolveSupportUrl,
} from "@/src/lib/settings/supportLinks";

import {
  UGC_PUBLISH_ACK_LABEL,
  UGC_TERMS_URL,
  canPublishWithUgcAck,
} from "./ugcSafety";

describe("Create terms gate (ugcSafety)", () => {
  it("blocks publish until the viewer explicitly acknowledges Terms", () => {
    expect(canPublishWithUgcAck(false)).toBe(false);
    expect(canPublishWithUgcAck(true)).toBe(true);
    expect(UGC_PUBLISH_ACK_LABEL).toMatch(/Terms/);
    expect(UGC_PUBLISH_ACK_LABEL).toMatch(/objectionable content/i);
  });

  it("points the Create gate at the allowlisted public Terms URL", () => {
    expect(UGC_TERMS_URL).toBe("https://umtuba.com/terms");
    expect(UGC_TERMS_URL).toBe(getSupportUrl("terms"));
    expect(resolveSupportUrl(UGC_TERMS_URL)).toBe(UGC_TERMS_URL);
    expect(isAllowedSupportUrl(UGC_TERMS_URL)).toBe(true);
    expect(isAllowedSupportUrl("https://evil.example/terms")).toBe(false);
  });
});
