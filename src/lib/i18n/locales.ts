/**
 * Shared mobile locale contract — identical to web foundation.
 * Supported locales only; unsupported inputs fail closed to English.
 */

export const SUPPORTED_LOCALES = ["ar", "en", "fr", "es", "de", "pt"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export type TextDirection = "rtl" | "ltr";

export type LocaleDefinition = {
  code: AppLocale;
  direction: TextDirection;
  bcp47: string;
  nativeName: string;
  englishName: string;
};

export const LOCALE_DEFINITIONS: Record<AppLocale, LocaleDefinition> = {
  ar: {
    code: "ar",
    direction: "rtl",
    bcp47: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
  },
  en: {
    code: "en",
    direction: "ltr",
    bcp47: "en",
    nativeName: "English",
    englishName: "English",
  },
  fr: {
    code: "fr",
    direction: "ltr",
    bcp47: "fr",
    nativeName: "Français",
    englishName: "French",
  },
  es: {
    code: "es",
    direction: "ltr",
    bcp47: "es",
    nativeName: "Español",
    englishName: "Spanish",
  },
  de: {
    code: "de",
    direction: "ltr",
    bcp47: "de",
    nativeName: "Deutsch",
    englishName: "German",
  },
  pt: {
    code: "pt",
    direction: "ltr",
    bcp47: "pt",
    nativeName: "Português",
    englishName: "Portuguese",
  },
};

export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Normalize BCP 47 / device tags to a supported AppLocale.
 * fr-CA → fr, pt-BR → pt, ar-SA → ar. Unsupported → null.
 */
export function normalizeToAppLocale(
  raw: string | null | undefined
): AppLocale | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase().replace(/_/g, "-");
  if (!trimmed) return null;
  if (isAppLocale(trimmed)) return trimmed;
  const primary = trimmed.split("-")[0] ?? "";
  if (isAppLocale(primary)) return primary;
  return null;
}

export function resolveLocaleOrFallback(
  raw: string | null | undefined
): AppLocale {
  return normalizeToAppLocale(raw) ?? DEFAULT_LOCALE;
}

export function getLocaleDirection(locale: AppLocale): TextDirection {
  return LOCALE_DEFINITIONS[locale].direction;
}

export function isRtlLocale(locale: AppLocale): boolean {
  return locale === "ar";
}

export function getLocaleDefinition(locale: AppLocale): LocaleDefinition {
  return LOCALE_DEFINITIONS[locale];
}

export function listSupportedLocales(): LocaleDefinition[] {
  return SUPPORTED_LOCALES.map((code) => LOCALE_DEFINITIONS[code]);
}

/**
 * Map a device/system tag to a UMTUBA locale.
 * Unsupported or missing → en. Does not apply user override.
 */
export function detectDeviceLocale(raw?: string | null): AppLocale {
  return resolveLocaleOrFallback(raw);
}
