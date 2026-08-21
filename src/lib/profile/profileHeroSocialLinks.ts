/**
 * Website + optional social/external chips. Hide-when-empty.
 * Uses only supplied About fields — mobile has no website/links columns.
 */

export const PROFILE_HERO_SOCIAL_LINK_MAX = 4;

export type ProfileAboutLink = {
  label: string;
  href: string;
};

export type NormalizedHeroLink = {
  label: string;
  href: string;
};

/**
 * Build a safe external href. Adds https:// when scheme is missing.
 * Returns null for empty / whitespace-only / non-http schemes.
 */
export function toExternalHref(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) {
    return null;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return null;
  }
  return `https://${value}`;
}

/** Display host/path without scheme for Hero website text. */
export function formatWebsiteLabel(
  raw: string | null | undefined
): string | null {
  const href = toExternalHref(raw);
  if (!href) {
    return null;
  }
  return href.replace(/^https?:\/\//i, "");
}

/**
 * Normalize About links: trim, require label+href, http(s) only, dedupe, cap.
 * Empty list → hide row.
 */
export function normalizeHeroSocialLinks(
  links: readonly ProfileAboutLink[] | null | undefined
): NormalizedHeroLink[] {
  if (!links?.length) {
    return [];
  }

  const seen = new Set<string>();
  const out: NormalizedHeroLink[] = [];

  for (const link of links) {
    const label = link.label?.trim() ?? "";
    const href = toExternalHref(link.href);
    if (!label || !href) {
      continue;
    }
    const key = href.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({ label, href });
    if (out.length >= PROFILE_HERO_SOCIAL_LINK_MAX) {
      break;
    }
  }

  return out;
}

export function shouldShowHeroWebsite(
  website: string | null | undefined
): boolean {
  return toExternalHref(website) != null;
}

export function shouldShowHeroSocialLinks(
  links: readonly ProfileAboutLink[] | null | undefined
): boolean {
  return normalizeHeroSocialLinks(links).length > 0;
}
