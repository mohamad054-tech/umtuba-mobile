/**
 * Successful login / signup / email-confirm must land on Profile
 * inside the tab navigator so the user is not stranded on the root
 * Stack `/profile` screen (no tab chrome, empty back stack).
 *
 * Cold start / session restore stays on Watch (`app/index.tsx`).
 */
export const POST_AUTH_HREF = "/(tabs)/profile" as const;

export function postAuthHref(): typeof POST_AUTH_HREF {
  return POST_AUTH_HREF;
}
