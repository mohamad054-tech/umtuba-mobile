import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";

import { detectInstalledDeviceLocale } from "./deviceLocale";
import {
  getLocaleDefinition,
  getLocaleDirection,
  listSupportedLocales,
  type AppLocale,
  type TextDirection,
} from "./locales";
import { applyRtl, localeRootStyle } from "./rtl";
import {
  clearLocaleOverride,
  loadLocaleOverride,
  resolveEffectiveLocale,
  saveLocaleOverride,
} from "./storage";
import { createTranslator, type TranslateOptions } from "./translate";
import type { TranslationKey } from "./messages/types";

type I18nContextValue = {
  locale: AppLocale;
  direction: TextDirection;
  override: AppLocale | null;
  deviceLocale: AppLocale;
  ready: boolean;
  t: (key: TranslationKey, options?: TranslateOptions) => string;
  setOverride: (locale: AppLocale) => Promise<void>;
  resetToDevice: () => Promise<void>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const deviceLocale = useMemo(() => detectInstalledDeviceLocale(), []);
  const [override, setOverrideState] = useState<AppLocale | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLocaleOverride().then((saved) => {
      if (!cancelled) {
        setOverrideState(saved);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const locale = resolveEffectiveLocale(override, deviceLocale);

  useEffect(() => {
    applyRtl(locale);
  }, [locale]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const setOverride = useCallback(async (next: AppLocale) => {
    await saveLocaleOverride(next);
    setOverrideState(next);
  }, []);

  const resetToDevice = useCallback(async () => {
    await clearLocaleOverride();
    setOverrideState(null);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: getLocaleDirection(locale),
      override,
      deviceLocale,
      ready,
      t,
      setOverride,
      resetToDevice,
    }),
    [deviceLocale, locale, override, ready, resetToDevice, setOverride, t]
  );

  return (
    <I18nContext.Provider value={value}>
      <View style={localeRootStyle(locale)}>{children}</View>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useTranslation() {
  const { locale, direction, t, override, deviceLocale, resetToDevice, setOverride } =
    useI18n();
  return {
    locale,
    direction,
    t,
    override,
    deviceLocale,
    resetToDevice,
    setOverride,
    options: listSupportedLocales(),
    currentDefinition: getLocaleDefinition(locale),
  };
}
