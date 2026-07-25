/**
 * Detect missing messenger tables/RPCs (fail-closed unavailable).
 */
export function isMessengerBackendMissing(
  message: string | null | undefined
): boolean {
  if (!message) return false;
  return /could not find the (table|function)|schema cache|does not exist|PGRST202|PGRST205|404/i.test(
    message
  );
}
