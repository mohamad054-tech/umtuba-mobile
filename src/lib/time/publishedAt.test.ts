import { describe, expect, it } from "vitest";

import {
  AUTHORITATIVE_PUBLISH_TIMESTAMP,
  clientWriteOmitsPublishClock,
  formatPublishedAt,
  parseServerDate,
  resolveAuthoritativePublishedAt,
} from "./publishedAt";

const SAMPLE = "2026-08-19T20:02:00.000Z";

describe("publication timestamp contract", () => {
  it("reuses created_at as the authoritative publish time", () => {
    expect(AUTHORITATIVE_PUBLISH_TIMESTAMP).toBe("created_at");
    expect(
      resolveAuthoritativePublishedAt({
        created_at: SAMPLE,
        updated_at: "2099-01-01T00:00:00.000Z",
      })
    ).toBe(SAMPLE);
  });

  it("prefers published_at when present and ignores updated_at", () => {
    expect(
      resolveAuthoritativePublishedAt({
        published_at: "2026-08-19T21:00:00.000Z",
        created_at: SAMPLE,
        updated_at: "2099-01-01T00:00:00.000Z",
      })
    ).toBe("2026-08-19T21:00:00.000Z");
  });

  it("never invents a device-clock timestamp", () => {
    expect(resolveAuthoritativePublishedAt({})).toBeNull();
    expect(
      resolveAuthoritativePublishedAt({
        updated_at: new Date().toISOString(),
      })
    ).toBeNull();
    expect(parseServerDate("not-a-date")).toBeNull();
    expect(formatPublishedAt("Invalid Date", "en")).toBe("");
    expect(formatPublishedAt("", "en")).toBe("");
    expect(formatPublishedAt(null, "en")).toBe("");
  });

  it("rejects client write payloads that forge publish time", () => {
    expect(clientWriteOmitsPublishClock({ caption: "ok" })).toBe(true);
    expect(clientWriteOmitsPublishClock({ created_at: SAMPLE })).toBe(false);
    expect(clientWriteOmitsPublishClock({ published_at: SAMPLE })).toBe(false);
    expect(clientWriteOmitsPublishClock({ updated_at: SAMPLE })).toBe(false);
  });

  it("formats EN / AR / ZH-CN / JA / KO without hard-coded months", () => {
    const en = formatPublishedAt(SAMPLE, "en-US", "UTC");
    const ar = formatPublishedAt(SAMPLE, "ar", "UTC");
    const zh = formatPublishedAt(SAMPLE, "zh-CN", "UTC");
    const ja = formatPublishedAt(SAMPLE, "ja", "UTC");
    const ko = formatPublishedAt(SAMPLE, "ko", "UTC");
    expect(en).toMatch(/2026/);
    expect(en).toMatch(/Aug|August|8/);
    expect(en).toMatch(/8:02|20:02/);
    expect(ar.length).toBeGreaterThan(4);
    expect(zh).toMatch(/2026/);
    expect(ja).toMatch(/2026/);
    expect(ko).toMatch(/2026/);
    expect(en).not.toBe(ar);
    expect(en).not.toBe(zh);
    expect(en).not.toBe(ja);
    expect(en).not.toBe(ko);
  });

  it("formats the remaining product locales and keeps timezone display local-unless-overridden", () => {
    for (const locale of ["fr", "es", "de", "pt-BR", "id", "hi", "ru", "tr"]) {
      const label = formatPublishedAt(SAMPLE, locale, "UTC");
      expect(label.length, locale).toBeGreaterThan(4);
      expect(label).toMatch(/2026/);
    }
    const utc = formatPublishedAt(SAMPLE, "en-US", "UTC");
    const tokyo = formatPublishedAt(SAMPLE, "en-US", "Asia/Tokyo");
    expect(utc).not.toBe(tokyo);
  });
});
