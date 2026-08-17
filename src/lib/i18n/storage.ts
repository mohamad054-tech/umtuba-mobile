/**
 * Persist explicit language override separately from detected locale.
 * Key is empty/absent → no override → device locale is effective.
 *
 * Phone builds: SecureStore first (same path as auth/referral), AsyncStorage
 * fallback. Tests inject memory storage. Not an iOS/Android localization fork.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { detectDeviceLocale, isAppLocale, type AppLocale } from "./locales";

function nativePlatform(): string {
  try {
    const rn = require("react-native") as { Platform?: { OS?: string } };
    return rn.Platform?.OS ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    const store = require("expo-secure-store") as {
      getItemAsync?: (k: string) => Promise<string | null>;
    };
    return (await store.getItemAsync?.(key)) ?? null;
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    const store = require("expo-secure-store") as {
      setItemAsync?: (k: string, v: string) => Promise<void>;
    };
    if (!store.setItemAsync) return false;
    await store.setItemAsync(key, value);
    return true;
  } catch {
    return false;
  }
}

async function secureRemove(key: string): Promise<void> {
  try {
    const store = require("expo-secure-store") as {
      deleteItemAsync?: (k: string) => Promise<void>;
    };
    await store.deleteItemAsync?.(key);
  } catch {
    // ignore
  }
}

export const LOCALE_OVERRIDE_STORAGE_KEY = "umtuba.locale.override";

export type LocaleStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let storageForTests: LocaleStorage | null = null;

export function setLocaleStorageForTests(storage: LocaleStorage | null): void {
  storageForTests = storage;
}

async function readRaw(key: string): Promise<string | null> {
  if (storageForTests) return storageForTests.getItem(key);
  if (nativePlatform() !== "web") {
    const secure = await secureGet(key);
    if (secure != null) return secure;
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeRaw(key: string, value: string): Promise<void> {
  if (storageForTests) {
    await storageForTests.setItem(key, value);
    return;
  }
  if (nativePlatform() !== "web") {
    const saved = await secureSet(key, value);
    if (saved) {
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        // SecureStore is enough to survive restart
      }
      return;
    }
  }
  await AsyncStorage.setItem(key, value);
}

async function removeRaw(key: string): Promise<void> {
  if (storageForTests) {
    await storageForTests.removeItem(key);
    return;
  }
  if (nativePlatform() !== "web") {
    await secureRemove(key);
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function parseLocaleOverride(
  raw: string | null | undefined
): AppLocale | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return isAppLocale(trimmed) ? trimmed : null;
}

export async function loadLocaleOverride(): Promise<AppLocale | null> {
  try {
    return parseLocaleOverride(await readRaw(LOCALE_OVERRIDE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function saveLocaleOverride(locale: AppLocale): Promise<void> {
  await writeRaw(LOCALE_OVERRIDE_STORAGE_KEY, locale);
}

/** Reset-to-device: clear override so detectDeviceLocale becomes effective. */
export async function clearLocaleOverride(): Promise<void> {
  await removeRaw(LOCALE_OVERRIDE_STORAGE_KEY);
}

/**
 * Apply the override in memory first so the selector updates even if persist
 * throws. Persistence is best-effort after the UI commit.
 */
export async function commitLocaleOverride(
  next: AppLocale,
  apply: (locale: AppLocale) => void
): Promise<void> {
  apply(next);
  try {
    await saveLocaleOverride(next);
  } catch {
    // Keep the in-memory override so the tap still changes UI.
  }
}

export async function commitLocaleReset(
  apply: () => void
): Promise<void> {
  apply();
  try {
    await clearLocaleOverride();
  } catch {
    // Keep the in-memory reset.
  }
}

export function resolveEffectiveLocale(
  override: AppLocale | null,
  deviceRaw?: string | null
): AppLocale {
  if (override) return override;
  return detectDeviceLocale(deviceRaw);
}
