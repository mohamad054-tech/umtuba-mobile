import { normalizeUsername } from "@/src/contracts/validation";

const PROFILE_USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProfileTarget =
  | { kind: "own" }
  | { kind: "other"; username: string; userId?: string };

export type OtherProfileLookupPlan = {
  primary: { field: "id"; value: string } | { field: "username"; value: string };
  fallback: { field: "username"; value: string } | null;
};

function firstString(
  value: string | string[] | null | undefined
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

/** Auth / profiles.id. Rejects display names and denormalized handles. */
export function parseProfileUserId(
  value: string | string[] | null | undefined
): string | null {
  const raw = firstString(value).trim();
  return PROFILE_USER_ID_RE.test(raw) ? raw : null;
}

/**
 * `/profile?id=` (profiles.id / posts.user_id) wins over `/profile?u=`.
 * Empty / self / missing query keeps the signed-in own profile.
 */
export function resolveProfileTarget(input: {
  queryUsername?: string | string[] | null;
  queryUserId?: string | string[] | null;
  signedInUsername?: string | null;
  signedInUserId?: string | null;
}): ProfileTarget {
  const queried = normalizeUsername(firstString(input.queryUsername));
  const userId = parseProfileUserId(input.queryUserId);
  const ownId = parseProfileUserId(input.signedInUserId);

  if (userId) {
    if (ownId && ownId.toLowerCase() === userId.toLowerCase()) {
      return { kind: "own" };
    }
    return { kind: "other", username: queried, userId };
  }

  if (!queried) {
    return { kind: "own" };
  }
  const own = normalizeUsername(input.signedInUsername ?? "");
  if (own && queried === own) {
    return { kind: "own" };
  }
  return { kind: "other", username: queried };
}

/** Watch / deep-link other-user fetch: id first, denormalized username second. */
export function planOtherProfileLookup(
  target: Extract<ProfileTarget, { kind: "other" }>
): OtherProfileLookupPlan {
  if (target.userId) {
    return {
      primary: { field: "id", value: target.userId },
      fallback: target.username
        ? { field: "username", value: target.username }
        : null,
    };
  }
  return {
    primary: { field: "username", value: target.username },
    fallback: null,
  };
}
