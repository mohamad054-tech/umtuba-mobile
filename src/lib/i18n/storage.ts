/**
 * Persist explicit language override separately from detected locale.
 * Key is empty/absent → no override → device locale is effective.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { detectDeviceLocale, isAppLocale, type AppLocale } from "./locales";

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

function store(): LocaleStorage {
  return storageForTests ?? AsyncStorage;
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
    return parseLocaleOverride(await store().getItem(LOCALE_OVERRIDE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export async function saveLocaleOverride(locale: AppLocale): Promise<void> {
  await store().setItem(LOCALE_OVERRIDE_STORAGE_KEY, locale);
}

/** Reset-to-device: clear override so detectDeviceLocale becomes effective. */
export async function clearLocaleOverride(): Promise<void> {
  await store().removeItem(LOCALE_OVERRIDE_STORAGE_KEY);
}

export function resolveEffectiveLocale(
  override: AppLocale | null,
  deviceRaw?: string | null
): AppLocale {
  if (override) return override;
  return detectDeviceLocale(deviceRaw);
}
