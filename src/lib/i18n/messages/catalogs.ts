import type { AppLocale } from "../locales";
import { arMessages } from "./ar";
import { deMessages } from "./de";
import { enMessages } from "./en";
import { esMessages } from "./es";
import { frMessages } from "./fr";
import { ptMessages } from "./pt";
import type { MobileMessages } from "./types";

export const MESSAGE_CATALOGS: Record<AppLocale, MobileMessages> = {
  ar: arMessages,
  en: enMessages,
  fr: frMessages,
  es: esMessages,
  de: deMessages,
  pt: ptMessages,
};

export function getMessageCatalog(locale: AppLocale): MobileMessages {
  return MESSAGE_CATALOGS[locale] ?? enMessages;
}
