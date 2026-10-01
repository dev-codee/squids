import { getRegionConfig } from "@/lib/regions";

export type SupportedLocale = "en" | "de" | "fr" | "es" | "it";

export const SUPPORTED_LOCALES: SupportedLocale[] = ["en", "de", "fr", "es", "it"];

export const LOCALE_LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
};

/**
 * Check if a locale code is one of the 5 supported Phase 2 languages.
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as string[]).includes(locale.toLowerCase());
}

/**
 * Get the full English language name (e.g. "German", "French") for a locale code.
 * Falls back to "English" for unsupported locales.
 */
export function languageNameForLocale(locale: string): string {
  const norm = locale.toLowerCase().split("-")[0] as SupportedLocale;
  return LOCALE_LANGUAGE_NAMES[norm] ?? "English";
}

/**
 * Resolve the supported 2-letter language locale for a country code.
 * Reuses region locale resolution: e.g. "AT" -> "de", "MX" -> "es", "JP" -> "en".
 */
export function localeForCountry(countryCode?: string | null): SupportedLocale {
  if (!countryCode) return "en";
  const region = getRegionConfig(countryCode);
  const lang = region.locale.split("-")[0].toLowerCase();
  return isSupportedLocale(lang) ? lang : "en";
}
