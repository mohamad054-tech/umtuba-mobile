/**
 * Allowlisted public support destinations. Fail-closed: anything else is rejected.
 */
export const SUPPORT_LINKS = {
  about: "https://umtuba.com",
  /** Dedicated /support is 404. Use the live privacy page as the support URL. */
  help: "https://umtuba.com/privacy",
  contact: "https://umtuba.com/privacy",
  support: "https://umtuba.com/privacy",
  privacy: "https://umtuba.com/privacy",
  terms: "https://umtuba.com/terms",
  /** Central/Desktop web account-deletion contract. Do not recreate the backend here. */
  accountDeletion: "https://umtuba.com/account-deletion",
} as const;

export type SupportLinkKey = keyof typeof SUPPORT_LINKS;

const ALLOWED = new Set<string>(Object.values(SUPPORT_LINKS));

export function getSupportUrl(key: SupportLinkKey): string {
  return SUPPORT_LINKS[key];
}

/** Returns the URL only when it matches the allowlist exactly. */
export function resolveSupportUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!ALLOWED.has(trimmed)) return null;
  return trimmed;
}

export function isAllowedSupportUrl(raw: string | null | undefined): boolean {
  return resolveSupportUrl(raw) !== null;
}
