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
export {
  DISCOVER_CATEGORY_KEYS,
  DISCOVER_SECTION_MESSAGE_KEYS,
  DISCOVER_SECTION_TITLE_KEYS,
  LIVE_STATUS_KEYS,
  MESSAGE_RECEIPT_KEYS,
  NOTIFICATION_CATEGORY_KEYS,
  REPORT_REASON_KEYS,
  WORLD_CATEGORY_KEYS,
  WORLD_KIND_KEYS,
} from "./uiKeys";
