import 'server-only';

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  de: () => import('./dictionaries/de.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
  es: () => import('./dictionaries/es.json').then((module) => module.default),
  it: () => import('./dictionaries/it.json').then((module) => module.default),
};

const countryToLocale: Record<string, keyof typeof dictionaries> = {
  de: 'de',
  at: 'de',
  ch: 'de',
  fr: 'fr',
  es: 'es',
  mx: 'es',
  ar: 'es',
  co: 'es',
  it: 'it',
  // Everything else defaults to 'en'
};

export const getDictionary = async (countryCode: string) => {
  const locale = countryToLocale[countryCode.toLowerCase()] || 'en';
  return dictionaries[locale]();
};

export type Dictionary = Awaited<ReturnType<typeof dictionaries['en']>>;
