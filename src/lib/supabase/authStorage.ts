/**
 * Shared Supabase auth storage.
 *
 * Persist the session/refresh token only — never email/password.
 *
 * Android expo-secure-store uses EncryptedSharedPreferences + Keystore.
 * A successful SecureStore write used to delete the AsyncStorage copy.
 * If Keystore later desyncs (reinstall, key rotation, decrypt failure),
 * getItem returned null and the session was gone. iOS Keychain is more
 * tolerant, which matches "Android loses the session, iOS does not".
 *
 * Contract:
 * - Always keep a durable AsyncStorage copy of the session JSON.
 * - Also write SecureStore when the payload is small enough.
 * - Read SecureStore first; fall back to AsyncStorage on miss/empty/error.
 * - Logout/removeItem clears both.
 */

/** Historical Android SecureStore payload ceiling (~2KB). Stay under it. */
export const SECURE_STORE_SAFE_BYTES = 1800;

export type AuthStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return unescape(encodeURIComponent(value)).length;
}

export function isUsableStoredValue(
  value: string | null | undefined
): value is string {
  return typeof value === "string" && value.length > 0;
}

export function createAuthStorageAdapter(deps: {
  platform: string;
  secureGet: (key: string) => Promise<string | null>;
  secureSet: (key: string, value: string) => Promise<void>;
  secureRemove: (key: string) => Promise<void>;
  asyncGet: (key: string) => Promise<string | null>;
  asyncSet: (key: string, value: string) => Promise<void>;
  asyncRemove: (key: string) => Promise<void>;
  safeBytes?: number;
}): AuthStorageAdapter {
  const limit = deps.safeBytes ?? SECURE_STORE_SAFE_BYTES;

  return {
    getItem: async (key: string): Promise<string | null> => {
      if (deps.platform === "web") {
        return deps.asyncGet(key);
      }

      try {
        const secure = await deps.secureGet(key);
        if (isUsableStoredValue(secure)) {
          return secure;
        }
      } catch {
        // Keystore decrypt / availability — use durable copy.
      }
      return deps.asyncGet(key);
    },

    setItem: async (key: string, value: string): Promise<void> => {
      if (deps.platform === "web") {
        await deps.asyncSet(key, value);
        return;
      }

      // Durable copy first so a later Keystore failure cannot drop the session.
      await deps.asyncSet(key, value);

      if (utf8ByteLength(value) > limit) {
        try {
          await deps.secureRemove(key);
        } catch {
          // ignore
        }
        return;
      }

      try {
        await deps.secureSet(key, value);
      } catch {
        // AsyncStorage already has the session.
      }
    },

    removeItem: async (key: string): Promise<void> => {
      if (deps.platform !== "web") {
        try {
          await deps.secureRemove(key);
        } catch {
          // ignore
        }
      }
      await deps.asyncRemove(key);
    },
  };
}
