import { afterEach, describe, expect, it } from "vitest";

import { detectInstalledDeviceLocale } from "./deviceLocale";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  detectDeviceLocale,
  getLocaleDirection,
  isRtlLocale,
  listSupportedLocales,
  normalizeToAppLocale,
  type AppLocale,
} from "./locales";
import { MESSAGE_CATALOGS } from "./messages/catalogs";
import { enMessages } from "./messages/en";
import type { TranslationKey } from "./messages/types";
import {
  LOCALE_OVERRIDE_STORAGE_KEY,
  clearLocaleOverride,
  commitLocaleOverride,
  commitLocaleReset,
  loadLocaleOverride,
  resolveEffectiveLocale,
  saveLocaleOverride,
  setLocaleStorageForTests,
} from "./storage";
import { rawCatalogValue, translate, translationKeySet } from "./translate";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    async getItem(key: string) {
      return key in data ? data[key]! : null;
    },
    async setItem(key: string, value: string) {
      data[key] = value;
    },
    async removeItem(key: string) {
      delete data[key];
    },
    data,
  };
}

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER_RE)].map((m) => m[1]!).sort();
}

const BRAND_OR_IDENTICAL = new Set([
  "UMTUBA",
  "UM Points",
  "Live",
  "Hashtags",
  "Social",
  "Messages",
  "Message",
  "Notifications",
  "Conversation",
  "Contact",
  "Commerce",
  "Error",
]);

afterEach(() => {
  setLocaleStorageForTests(null);
});

describe("locale contract", () => {
  it("supports the six platform locales", () => {
    expect([...SUPPORTED_LOCALES]).toEqual(["ar", "en", "fr", "es", "de", "pt"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("lists all six languages for the selector", () => {
    const codes = listSupportedLocales().map((row) => row.code);
    expect(codes).toEqual(["ar", "en", "fr", "es", "de", "pt"]);
    expect(listSupportedLocales()).toHaveLength(6);
  });

  it("detectDeviceLocale maps primary subtags and falls back to en", () => {
    expect(detectDeviceLocale("ar-SA")).toBe("ar");
    expect(detectDeviceLocale("fr-CA")).toBe("fr");
    expect(detectDeviceLocale("pt-BR")).toBe("pt");
    expect(detectDeviceLocale("zh-CN")).toBe("en");
    expect(detectDeviceLocale(undefined)).toBe("en");
    expect(detectDeviceLocale(null)).toBe("en");
    expect(normalizeToAppLocale("pt_BR")).toBe("pt");
  });

  it("RTL is true iff locale is ar", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isRtlLocale(locale)).toBe(locale === "ar");
      expect(getLocaleDirection(locale)).toBe(locale === "ar" ? "rtl" : "ltr");
    }
  });
});

describe("locale selection policy", () => {
  it("override wins over device", () => {
    expect(resolveEffectiveLocale("de", "ar-SA")).toBe("de");
    expect(resolveEffectiveLocale("fr", "zh-CN")).toBe("fr");
  });

  it("clear override uses device locale", async () => {
    const store = memoryStorage();
    setLocaleStorageForTests(store);
    await saveLocaleOverride("es");
    expect(await loadLocaleOverride()).toBe("es");
    expect(store.data[LOCALE_OVERRIDE_STORAGE_KEY]).toBe("es");
    expect(resolveEffectiveLocale("es", "ar-SA")).toBe("es");

    await clearLocaleOverride();
    expect(await loadLocaleOverride()).toBeNull();
    expect(store.data[LOCALE_OVERRIDE_STORAGE_KEY]).toBeUndefined();
    expect(resolveEffectiveLocale(null, "ar-SA")).toBe("ar");
    expect(resolveEffectiveLocale(null, "zh-CN")).toBe("en");
  });

  it("applies the override even when persist throws", async () => {
    setLocaleStorageForTests({
      async getItem() {
        return null;
      },
      async setItem() {
        throw new Error("storage unavailable");
      },
      async removeItem() {
        throw new Error("storage unavailable");
      },
    });
    let applied: string | null = "en";
    await commitLocaleOverride("fr", (next) => {
      applied = next;
    });
    expect(applied).toBe("fr");
    await commitLocaleReset(() => {
      applied = null;
    });
    expect(applied).toBeNull();
  });

  it("new install without override uses device, not forced English", () => {
    expect(resolveEffectiveLocale(null, "pt-BR")).toBe("pt");
    expect(resolveEffectiveLocale(null, "fr-CA")).toBe("fr");
    expect(detectInstalledDeviceLocale()).toBeTypeOf("string");
  });
});

describe("catalog completeness", () => {
  const keys = translationKeySet();

  it("all six catalogs have identical key sets", () => {
    const expected = [...keys].sort();
    for (const locale of SUPPORTED_LOCALES) {
      const actual = Object.keys(MESSAGE_CATALOGS[locale]).sort();
      expect(actual).toEqual(expected);
    }
  });

  it("has no empty translations", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        const value = rawCatalogValue(locale, key);
        expect(value.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("missing key falls back to English", () => {
    const catalog = MESSAGE_CATALOGS.fr;
    const original = catalog["nav.watch"];
    (catalog as { "nav.watch": string })["nav.watch"] = "";
    expect(translate("fr", "nav.watch")).toBe(enMessages["nav.watch"]);
    (catalog as { "nav.watch": string })["nav.watch"] = original;
    expect(translate("en", "this.key.does.not.exist" as TranslationKey)).toBe(
      "this.key.does.not.exist"
    );
  });

  it("preserves placeholders across locales", () => {
    for (const key of keys) {
      const expected = placeholders(enMessages[key]);
      if (expected.length === 0) continue;
      for (const locale of SUPPORTED_LOCALES) {
        expect(placeholders(rawCatalogValue(locale, key)), `${locale}:${key}`).toEqual(
          expected
        );
      }
    }
  });

  it("does not leak English chrome except brand/identical-native terms", () => {
    const leaks: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === "en") continue;
      for (const key of keys) {
        const value = rawCatalogValue(locale, key);
        const source = enMessages[key];
        if (value === source && !BRAND_OR_IDENTICAL.has(source)) {
          const onlyBrand = /UMTUBA|UM Points|\.env/.test(source) && source.length < 24;
          if (!onlyBrand) leaks.push(`${locale}:${key}=${source}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it("localizes Create limited-library access copy", () => {
    expect(enMessages["create.limitedLibrary"]).toMatch(/selected/i);
    expect(enMessages["create.manageLibraryAccess"]).toBe("Add more videos");
    expect(enMessages["create.libraryAccessDenied"]).toMatch(/Settings/i);
    expect(MESSAGE_CATALOGS.ar["create.limitedLibrary"]).not.toBe(
      enMessages["create.limitedLibrary"]
    );
    expect(MESSAGE_CATALOGS.fr["create.manageLibraryAccess"]).toBe(
      "Ajouter d’autres vidéos"
    );
  });

  it("adds shared Watch share-mode catalog keys", () => {
    expect(enMessages["watch.shareVideoLink"]).toBe("Share video link");
    expect(enMessages["watch.shareVideoFile"]).toBe("Share video");
    expect(enMessages["watch.copyLink"]).toBe("Copy link");
    expect(enMessages["watch.preparingVideo"]).toBe("Preparing video");
    expect(enMessages["watch.shareFailed"]).toBe("Share failed");
    expect(enMessages["watch.mediaUnavailable"]).toBe("Media unavailable");
    expect(MESSAGE_CATALOGS.ar["watch.shareVideoLink"]).toBe(
      "مشاركة رابط الفيديو"
    );
    expect(MESSAGE_CATALOGS.ar["watch.shareVideoFile"]).toBe(
      "مشاركة الفيديو كفيديو"
    );
  });

  it("localizes signup username validation without English leak", () => {
    expect(enMessages["auth.signup.usernameHint"]).toMatch(/3–24/);
    expect(MESSAGE_CATALOGS.ar["auth.signup.usernameHint"]).not.toBe(
      enMessages["auth.signup.usernameHint"]
    );
    expect(MESSAGE_CATALOGS.ar["auth.signup.usernameHint"]).not.toMatch(
      /lowercase letters/
    );
    expect(MESSAGE_CATALOGS.fr["auth.signup.usernameRequired"]).not.toBe(
      enMessages["auth.signup.usernameRequired"]
    );
  });

  it("localizes Watch double-back exit hint", () => {
    expect(enMessages["watch.pressBackAgainToExit"]).toBe(
      "Press Back again to exit Watch"
    );
    expect(MESSAGE_CATALOGS.ar["watch.pressBackAgainToExit"]).toBe(
      "اضغط رجوع مرة أخرى للخروج من شاهد"
    );
    expect(MESSAGE_CATALOGS.fr["watch.pressBackAgainToExit"]).toMatch(/Regarder/);
    expect(MESSAGE_CATALOGS.es["watch.pressBackAgainToExit"]).toMatch(/Ver/);
    expect(MESSAGE_CATALOGS.de["watch.pressBackAgainToExit"]).toMatch(/Ansehen/);
    expect(MESSAGE_CATALOGS.pt["watch.pressBackAgainToExit"]).toMatch(/Assistir/);
  });
});
