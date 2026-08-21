import { describe, expect, it } from "vitest";

import {
  formatWebsiteLabel,
  normalizeHeroSocialLinks,
  shouldShowHeroSocialLinks,
  shouldShowHeroWebsite,
  toExternalHref,
} from "@/src/lib/profile/profileHeroSocialLinks";

describe("profileHeroSocialLinks", () => {
  it("hides empty website and links", () => {
    expect(shouldShowHeroWebsite(null)).toBe(false);
    expect(shouldShowHeroWebsite("  ")).toBe(false);
    expect(shouldShowHeroSocialLinks([])).toBe(false);
    expect(normalizeHeroSocialLinks([])).toEqual([]);
  });

  it("accepts http(s) only and blocks dangerous schemes", () => {
    expect(toExternalHref("https://umtuba.com")).toBe("https://umtuba.com");
    expect(toExternalHref("umtuba.com")).toBe("https://umtuba.com");
    expect(toExternalHref("javascript:alert(1)")).toBeNull();
    expect(formatWebsiteLabel("https://umtuba.com/about")).toBe(
      "umtuba.com/about"
    );
  });

  it("dedupes and caps hero links", () => {
    const links = normalizeHeroSocialLinks([
      { label: "Site", href: "https://a.example" },
      { label: "Site 2", href: "https://a.example" },
      { label: "B", href: "https://b.example" },
      { label: "C", href: "https://c.example" },
      { label: "D", href: "https://d.example" },
      { label: "E", href: "https://e.example" },
    ]);
    expect(links.map((link) => link.href)).toEqual([
      "https://a.example",
      "https://b.example",
      "https://c.example",
      "https://d.example",
    ]);
  });
});
