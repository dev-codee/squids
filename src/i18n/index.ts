import 'server-only';
import { getRegionConfig } from '@/lib/regions';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  de: () => import('./dictionaries/de.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
  es: () => import('./dictionaries/es.json').then((module) => module.default),
  it: () => import('./dictionaries/it.json').then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;

const SUPPORTED_LOCALES = Object.keys(dictionaries) as Locale[];

/**
 * Resolve the UI language for a URL country segment. Single source of truth is
 * {@link getRegionConfig}: we take the language subtag of the region locale
 * (e.g. `de-AT` -> `de`, `es-MX` -> `es`) and use it when we ship a dictionary
 * for it; otherwise we fall back to English.
 *
 * This keeps the UI language, currency and formatting locale in sync — a region
 * that prices in EUR/German (DE, AT, CH) also renders German static text, and
 * regions without a translation (NL, PL, JP, …) fall back to English.
 */
export function localeForCountry(countryCode: string): Locale {
  const region = getRegionConfig(countryCode);
  const lang = region.locale.split('-')[0].toLowerCase();
  return (SUPPORTED_LOCALES as string[]).includes(lang) ? (lang as Locale) : 'en';
}

export const getDictionary = async (countryCode: string) => {
  return dictionaries[localeForCountry(countryCode)]();
};

export type Dictionary = Awaited<ReturnType<typeof dictionaries['en']>>;
