/**
 * One shared device-locale reader for iOS + Android.
 * expo-localization is the Expo API; Intl is the Node/test fallback.
 */

import { detectDeviceLocale, type AppLocale } from "./locales";

export function readDeviceLocaleTag(): string | undefined {
  try {
    // Lazy require so unit tests do not need the native module.
    const localization = require("expo-localization") as {
      getLocales?: () => Array<{
        languageTag?: string;
        languageCode?: string;
      }>;
    };
    const first = localization.getLocales?.()[0];
    const tag = first?.languageTag ?? first?.languageCode;
    if (typeof tag === "string" && tag.trim()) return tag;
  } catch {
    // fall through
  }
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    if (typeof tag === "string" && tag.trim()) return tag;
  } catch {
    // ignore
  }
  return undefined;
}

/** Effective device locale for a new install (no override). */
export function detectInstalledDeviceLocale(): AppLocale {
  return detectDeviceLocale(readDeviceLocaleTag());
}
