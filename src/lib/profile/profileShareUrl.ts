import { normalizeUsername } from "@/src/contracts/validation";

/** Same public origin as Watch share links — kept local to avoid RN test imports. */
const PUBLIC_WEB_ORIGIN = "https://umtuba.com";

/** Canonical public Creator Space URL. Username-only; never invents a handle. */
export function buildProfileShareUrl(
  username: string | null | undefined
): string | null {
  const key = normalizeUsername(username ?? "");
  if (!key) {
    return null;
  }
  return `${PUBLIC_WEB_ORIGIN}/profile/${encodeURIComponent(key)}`;
}
