export {
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  SUPPORTED_LOCALES,
  detectDeviceLocale,
  getLocaleDefinition,
  getLocaleDirection,
  isAppLocale,
  isRtlLocale,
  listSupportedLocales,
  normalizeToAppLocale,
  resolveLocaleOrFallback,
  type AppLocale,
  type LocaleDefinition,
  type TextDirection,
} from "./locales";

export {
  detectInstalledDeviceLocale,
  readDeviceLocaleTag,
} from "./deviceLocale";

export {
  LOCALE_OVERRIDE_STORAGE_KEY,
  clearLocaleOverride,
  loadLocaleOverride,
  parseLocaleOverride,
  resolveEffectiveLocale,
  saveLocaleOverride,
  setLocaleStorageForTests,
} from "./storage";

export {
  applyRtl,
  backGlyph,
  chevronGlyph,
  localeRootStyle,
  localeTextAlign,
  localeWritingDirection,
} from "./rtl";

export {
  createTranslator,
  rawCatalogValue,
  translate,
  translationKeySet,
  type TranslateOptions,
} from "./translate";

export { MESSAGE_CATALOGS, getMessageCatalog } from "./messages/catalogs";
export type { MobileMessages, TranslationKey } from "./messages/types";

export { I18nProvider, useI18n, useTranslation } from "./I18nProvider";
