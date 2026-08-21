/**
 * Bio expand gate + specialty chips. Hide-when-empty.
 * No invented specialties — mobile has no specialties column.
 */

export const PROFILE_HERO_SPECIALTY_CHIP_MAX = 3;

/** Character threshold for showing more/less. Short bios render fully. */
export const PROFILE_HERO_BIO_EXPAND_MIN_CHARS = 140;

export function normalizeSpecialtyChips(
  specialties: readonly string[] | null | undefined
): string[] {
  if (!specialties?.length) {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of specialties) {
    const label = raw.trim();
    if (!label) {
      continue;
    }
    const key = label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(label);
    if (out.length >= PROFILE_HERO_SPECIALTY_CHIP_MAX) {
      break;
    }
  }

  return out;
}

export function bioNeedsExpandToggle(bio: string | null | undefined): boolean {
  const text = bio?.trim() ?? "";
  if (!text) {
    return false;
  }
  return text.length >= PROFILE_HERO_BIO_EXPAND_MIN_CHARS;
}
