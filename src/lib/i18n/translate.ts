/**
 * Typed t() — never returns empty.
 * Missing / empty locale string → English → key (tests / last resort only).
 */

import { DEFAULT_LOCALE, type AppLocale } from "./locales";
import { getMessageCatalog } from "./messages/catalogs";
import { enMessages } from "./messages/en";
import type { TranslationKey } from "./messages/types";

export type TranslateOptions = {
  values?: Record<string, string | number>;
};

function interpolate(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value == null ? match : String(value);
  });
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function translate(
  locale: AppLocale,
  key: TranslationKey,
  options?: TranslateOptions
): string {
  const catalog = getMessageCatalog(locale);
  const primary = catalog[key];
  if (nonEmpty(primary)) {
    return interpolate(primary, options?.values);
  }

  const fallback = enMessages[key];
  if (nonEmpty(fallback)) {
    return interpolate(fallback, options?.values);
  }

  return key;
}

export function createTranslator(locale: AppLocale) {
  return (key: TranslationKey, options?: TranslateOptions) =>
    translate(locale, key, options);
}

/** Test helper: lookup a raw catalog string without fallback. */
export function rawCatalogValue(
  locale: AppLocale,
  key: TranslationKey
): string {
  return getMessageCatalog(locale)[key] ?? "";
}

export function translationKeySet(): TranslationKey[] {
  return Object.keys(enMessages) as TranslationKey[];
}

export { DEFAULT_LOCALE };
