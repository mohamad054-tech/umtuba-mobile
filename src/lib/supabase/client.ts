import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { getEnv } from "@/src/lib/env";

/**
 * Auth session storage:
 * - Native: Expo SecureStore (encrypted keychain / Keystore)
 * - Web / SecureStore failures: AsyncStorage fallback
 *
 * SecureStore values are capped (~2KB). If a session payload exceeds that,
 * setItem falls back to AsyncStorage automatically.
 *
 * Never use a service-role key in the mobile client.
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }

    try {
      const value = await SecureStore.getItemAsync(key);
      if (value != null) {
        return value;
      }
      return AsyncStorage.getItem(key);
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(key);
    } catch {
      // SecureStore size / availability limits → AsyncStorage fallback
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
    await AsyncStorage.removeItem(key);
  },
};

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
