/**
 * Auth bootstrap clobber guard.
 *
 * During startup, restore() may already have applied a valid persisted
 * session from the durable storage copy. Supabase can still emit
 * INITIAL_SESSION(null) on a SecureStore/Keystore miss. That event must
 * not wipe the restoring session.
 */

export function shouldSkipInitialSessionClobber(input: {
  hydrating: boolean;
  event: string;
  nextSession: unknown;
}): boolean {
  return (
    input.hydrating && input.event === "INITIAL_SESSION" && !input.nextSession
  );
}
