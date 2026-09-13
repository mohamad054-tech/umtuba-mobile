import { describe, expect, it } from "vitest";

import {
  UGC_PUBLISH_ACK_LABEL,
  UGC_TERMS_URL,
  canPublishWithUgcAck,
} from "./ugcSafety";

describe("ugcSafety", () => {
  it("requires an explicit publish acknowledgment", () => {
    expect(canPublishWithUgcAck(false)).toBe(false);
    expect(canPublishWithUgcAck(true)).toBe(true);
    expect(UGC_TERMS_URL).toBe("https://umtuba.com/terms");
    expect(UGC_PUBLISH_ACK_LABEL).toMatch(/Terms/);
    expect(UGC_PUBLISH_ACK_LABEL).toMatch(/community rules/);
  });
});
