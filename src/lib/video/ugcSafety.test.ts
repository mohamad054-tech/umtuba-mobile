import { describe, expect, it } from "vitest";

import {
  getSupportUrl,
  isAllowedSupportUrl,
  resolveSupportUrl,
} from "@/src/lib/settings/supportLinks";

import {
  CREATE_ACK_CHECKBOX_BORDER_WIDTH,
  CREATE_ACK_CHECKBOX_SIZE,
  CREATE_ACK_CHECK_MARK,
  CREATE_ACK_TOUCH_MIN_HEIGHT,
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

  it("keeps the confirmation control large enough to see and tap", () => {
    expect(CREATE_ACK_CHECKBOX_SIZE).toBeGreaterThanOrEqual(28);
    expect(CREATE_ACK_CHECKBOX_BORDER_WIDTH).toBeGreaterThanOrEqual(2);
    expect(CREATE_ACK_TOUCH_MIN_HEIGHT).toBeGreaterThanOrEqual(48);
    expect(CREATE_ACK_CHECK_MARK).toBe("✓");
  });

  it("points the Create gate at the allowlisted public Terms URL", () => {
    expect(UGC_TERMS_URL).toBe("https://umtuba.com/terms");
    expect(UGC_TERMS_URL).toBe(getSupportUrl("terms"));
    expect(resolveSupportUrl(UGC_TERMS_URL)).toBe(UGC_TERMS_URL);
    expect(isAllowedSupportUrl(UGC_TERMS_URL)).toBe(true);
    expect(isAllowedSupportUrl("https://evil.example/terms")).toBe(false);
  });
});
