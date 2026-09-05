export type UmStreakLocale = "en" | "ar";
export type UmStreakTextDirection = "ltr" | "rtl";

function deviceSignals(): { tag: string; isRTL: boolean } {
  try {
    // Lazy so vitest/node can import copy + locale without a RN runtime.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require("react-native") as {
      I18nManager?: { isRTL?: boolean; localeIdentifier?: string };
      NativeModules?: {
        SettingsManager?: {
          settings?: { AppleLocale?: string; AppleLanguages?: string[] };
        };
        I18nManager?: { localeIdentifier?: string };
      };
      Platform?: { OS?: string };
    };
    const ios =
      rn.NativeModules?.SettingsManager?.settings?.AppleLocale ||
      rn.NativeModules?.SettingsManager?.settings?.AppleLanguages?.[0];
    const android =
      rn.NativeModules?.I18nManager?.localeIdentifier ||
      rn.I18nManager?.localeIdentifier;
    const tag =
      (rn.Platform?.OS === "ios" ? ios : android) ||
      Intl.DateTimeFormat().resolvedOptions().locale ||
      "en";
    return {
      tag: String(tag),
      isRTL: Boolean(rn.I18nManager?.isRTL),
    };
  } catch {
    return {
      tag: Intl.DateTimeFormat().resolvedOptions().locale || "en",
      isRTL: false,
    };
  }
}

export function normalizeUmStreakLocale(
  raw: string | null | undefined
): UmStreakLocale {
  const tag = (raw || "").trim().toLowerCase().replace(/_/g, "-");
  if (tag === "ar" || tag.startsWith("ar-")) {
    return "ar";
  }
  return "en";
}

export function resolveDeviceLocaleTag(): string {
  return deviceSignals().tag;
}

export function detectUmStreakLocale(input?: {
  localeTag?: string | null;
  isRTL?: boolean;
}): UmStreakLocale {
  if (input?.localeTag != null && input.localeTag !== "") {
    return normalizeUmStreakLocale(input.localeTag);
  }
  const signals = deviceSignals();
  const fromDevice = normalizeUmStreakLocale(signals.tag);
  if (fromDevice === "ar") return "ar";
  if (input?.isRTL === true || signals.isRTL) {
    return "ar";
  }
  return "en";
}

export function umStreakDirection(locale: UmStreakLocale): UmStreakTextDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

export function umStreakTextAlign(
  locale: UmStreakLocale
): "left" | "right" {
  return locale === "ar" ? "right" : "left";
}

export function umStreakFlexDirection(
  locale: UmStreakLocale
): "row" | "row-reverse" {
  return locale === "ar" ? "row-reverse" : "row";
}

export function umStreakWritingStyle(locale: UmStreakLocale): {
  writingDirection: "ltr" | "rtl";
} {
  return { writingDirection: umStreakDirection(locale) };
}
