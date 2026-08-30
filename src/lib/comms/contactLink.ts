import { isValidUsername, normalizeUsername } from "@/src/contracts/validation";

export const PERSONAL_CONTACT_ORIGIN = "https://umtuba.com";
export const PERSONAL_CONTACT_PATH_PREFIX = "/u";

export function buildPersonalContactPath(username: string): string | null {
  const key = normalizeUsername(username);
  if (!isValidUsername(key)) {
    return null;
  }
  return `${PERSONAL_CONTACT_PATH_PREFIX}/${key}`;
}

/** Original UMTUBA presentation: /@{username}. Rewritten to /u/{username}. */
export function buildPersonalAtPath(username: string): string | null {
  const key = normalizeUsername(username);
  if (!isValidUsername(key)) {
    return null;
  }
  return `/@${key}`;
}

export function buildPersonalContactUrl(
  username: string,
  origin = PERSONAL_CONTACT_ORIGIN
): string | null {
  const atPath = buildPersonalAtPath(username);
  if (!atPath) {
    return null;
  }
  return `${origin.replace(/\/$/, "")}${atPath}`;
}

export type ParsedContactLink = {
  username: string;
};

const CONTACT_PATH_RE = /^\/(?:u\/|@)([a-z0-9._]{3,24})\/?$/i;

/**
 * Accepts /@handle, /u/handle, or an absolute same-style URL.
 * Rejects auth uids, phones, emails, and secret tokens.
 */
export function parsePersonalContactInput(
  raw: string
): ParsedContactLink | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (isValidUsername(trimmed)) {
    return { username: normalizeUsername(trimmed) };
  }

  let path = trimmed;
  try {
    if (/^https?:\/\//i.test(trimmed) || /^umtuba:\/\//i.test(trimmed)) {
      const normalized = trimmed.replace(/^umtuba:\/\//i, "https://umtuba.com/");
      const url = new URL(normalized);
      path = url.pathname;
    }
  } catch {
    return null;
  }

  const match = path.match(CONTACT_PATH_RE);
  if (!match?.[1]) {
    return null;
  }
  const username = normalizeUsername(match[1]);
  return isValidUsername(username) ? { username } : null;
}

export function isSafeContactUrlPayload(value: string): boolean {
  const parsed = parsePersonalContactInput(value);
  if (!parsed) {
    return false;
  }
  return (
    !/@[0-9a-f-]{36}/i.test(value) &&
    !/\+[1-9][0-9]{7,14}/.test(value) &&
    !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value.replace(/^https?:\/\/[^\s/]+\/@/, ""))
  );
}
