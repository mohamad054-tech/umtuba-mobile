import { normalizeUsername } from "@/src/contracts/validation";

export type ProfileTarget =
  | { kind: "own" }
  | { kind: "other"; username: string };

/**
 * `/profile?u=` targets another public username.
 * Empty / self / missing query keeps the signed-in own profile.
 */
export function resolveProfileTarget(input: {
  queryUsername?: string | string[] | null;
  signedInUsername?: string | null;
}): ProfileTarget {
  const raw = Array.isArray(input.queryUsername)
    ? input.queryUsername[0]
    : input.queryUsername;
  const queried = normalizeUsername(typeof raw === "string" ? raw : "");
  if (!queried) {
    return { kind: "own" };
  }
  const own = normalizeUsername(input.signedInUsername ?? "");
  if (own && queried === own) {
    return { kind: "own" };
  }
  return { kind: "other", username: queried };
}
