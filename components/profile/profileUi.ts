import type { TranslateOptions } from "@/src/lib/i18n/translate";
import type { TranslationKey } from "@/src/lib/i18n/messages/types";

export type ProfileTranslate = (
  key: TranslationKey,
  options?: TranslateOptions
) => string;
