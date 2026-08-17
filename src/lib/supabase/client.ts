import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getEnv } from "@/src/lib/env";
import { createAuthStorageAdapter } from "@/src/lib/supabase/authStorage";

const ExpoSecureStoreAdapter = createAuthStorageAdapter({
  platform: Platform.OS,
  secureGet: (key) => SecureStore.getItemAsync(key),
  secureSet: (key, value) => SecureStore.setItemAsync(key, value),
  secureRemove: (key) => SecureStore.deleteItemAsync(key),
  asyncGet: (key) => AsyncStorage.getItem(key),
  asyncSet: (key, value) => AsyncStorage.setItem(key, value),
  asyncRemove: (key) => AsyncStorage.removeItem(key),
});

/**
 * Auth session storage lives in authStorage.ts.
 * Persist session/refresh token only — never email/password.
 * Never use a service-role key in the mobile client.
 */

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) {
    return client;
  }

  const env = getEnv();

  client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}

/** @deprecated Prefer getSupabase() — kept for familiar naming. */
export function createSupabaseClient(): SupabaseClient {
  return getSupabase();
}
