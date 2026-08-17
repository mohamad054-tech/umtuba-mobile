import { I18nManager, type TextStyle, type ViewStyle } from "react-native";

import {
  getLocaleDirection,
  isRtlLocale,
  type AppLocale,
  type TextDirection,
} from "./locales";

export function applyRtl(locale: AppLocale): void {
  const rtl = isRtlLocale(locale);
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
    }
  } catch {
    // Native RTL flip is best-effort. Catalog + direction style still apply.
  }
}

export function backGlyph(locale: AppLocale): string {
  return isRtlLocale(locale) ? "›" : "‹";
}

export function chevronGlyph(locale: AppLocale): string {
  return isRtlLocale(locale) ? "‹" : "›";
}

export function localeTextAlign(locale: AppLocale): TextStyle["textAlign"] {
  return isRtlLocale(locale) ? "right" : "left";
}

export function localeWritingDirection(locale: AppLocale): TextDirection {
  return getLocaleDirection(locale);
}

export function localeRootStyle(locale: AppLocale): ViewStyle {
  return {
    flex: 1,
    direction: getLocaleDirection(locale),
  };
}
