/**
 * Per-region configuration: maps a URL country segment (e.g. the `de` in
 * `/de/amazon`) to its canonical currency and formatting locale.
 *
 * Dependency-free and safe to import anywhere (server components, client
 * components, and the Edge middleware).
 */

import { countryName } from "@/lib/countries";

export interface RegionConfig {
  /** ISO-3166-1 alpha-2 country code, uppercase (e.g. "DE"). */
  country: string;
  /** ISO-4217 currency code used to price this region (e.g. "EUR"). */
  currency: string;
  /** BCP-47 locale used for number/currency formatting (e.g. "de-DE"). */
  locale: string;
}

const CODE_RE = /^[A-Za-z]{2}$/;

/**
 * Cookie that remembers the visitor's explicitly chosen region so the root `/`
 * redirect can honour it instead of falling back to IP geolocation.
 */
export const REGION_COOKIE = "preferred_region";
export const REGION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** True when `code` is a syntactically valid 2-letter region code. */
export function isValidRegionCode(code: string | null | undefined): code is string {
  return typeof code === "string" && CODE_RE.test(code);
}

/** Fallback when a region isn't in the table below. */
const DEFAULT_REGION: Omit<RegionConfig, "country"> = {
  currency: "USD",
  locale: "en-US",
};

/**
 * Broad table of the regions we ship. Anything not listed falls back to
 * {@link DEFAULT_REGION} (USD / en-US) via {@link getRegionConfig}.
 */
const REGIONS: Record<string, Omit<RegionConfig, "country">> = {
  // North America
  US: { currency: "USD", locale: "en-US" },
  CA: { currency: "CAD", locale: "en-CA" },
  MX: { currency: "MXN", locale: "es-MX" },
  // United Kingdom & Ireland
  GB: { currency: "GBP", locale: "en-GB" },
  IE: { currency: "EUR", locale: "en-IE" },
  // Eurozone / German-speaking
  DE: { currency: "EUR", locale: "de-DE" },
  AT: { currency: "EUR", locale: "de-AT" },
  CH: { currency: "CHF", locale: "de-CH" },
  FR: { currency: "EUR", locale: "fr-FR" },
  ES: { currency: "EUR", locale: "es-ES" },
  IT: { currency: "EUR", locale: "it-IT" },
  NL: { currency: "EUR", locale: "nl-NL" },
  BE: { currency: "EUR", locale: "nl-BE" },
  PT: { currency: "EUR", locale: "pt-PT" },
  // Nordics
  SE: { currency: "SEK", locale: "sv-SE" },
  NO: { currency: "NOK", locale: "nb-NO" },
  DK: { currency: "DKK", locale: "da-DK" },
  FI: { currency: "EUR", locale: "fi-FI" },
  // Rest of Europe
  PL: { currency: "PLN", locale: "pl-PL" },
  // South Asia
  PK: { currency: "PKR", locale: "en-PK" },
  IN: { currency: "INR", locale: "en-IN" },
  BD: { currency: "BDT", locale: "bn-BD" },
  // Middle East
  AE: { currency: "AED", locale: "ar-AE" },
  SA: { currency: "SAR", locale: "ar-SA" },
  TR: { currency: "TRY", locale: "tr-TR" },
  // Asia-Pacific
  AU: { currency: "AUD", locale: "en-AU" },
  NZ: { currency: "NZD", locale: "en-NZ" },
  SG: { currency: "SGD", locale: "en-SG" },
  JP: { currency: "JPY", locale: "ja-JP" },
  CN: { currency: "CNY", locale: "zh-CN" },
  HK: { currency: "HKD", locale: "zh-HK" },
  // Latin America
  BR: { currency: "BRL", locale: "pt-BR" },
  AR: { currency: "ARS", locale: "es-AR" },
  CO: { currency: "COP", locale: "es-CO" },
  // Africa
  ZA: { currency: "ZAR", locale: "en-ZA" },
  NG: { currency: "NGN", locale: "en-NG" },
  EG: { currency: "EGP", locale: "ar-EG" },
};

/** Every configured region code (uppercase) — used for hreflang alternates. */
export const REGION_CODES = Object.keys(REGIONS);

/**
 * Resolve the {@link RegionConfig} for a URL country segment. Unknown or
 * malformed codes fall back to the default (USD / en-US) but keep "US" as the
 * canonical country so downstream links stay valid.
 */
export function getRegionConfig(country?: string | null): RegionConfig {
  const cc = (country || "").toUpperCase();
  if (!CODE_RE.test(cc) || !REGIONS[cc]) {
    return { country: cc && CODE_RE.test(cc) ? cc : "US", ...DEFAULT_REGION };
  }
  return { country: cc, ...REGIONS[cc] };
}

/** Format an amount already expressed in the region's currency. */
export function formatMoney(amount: number, region: RegionConfig): string {
  try {
    return new Intl.NumberFormat(region.locale, {
      style: "currency",
      currency: region.currency,
    }).format(amount);
  } catch {
    return `${region.currency} ${amount.toFixed(2)}`;
  }
}

/** Human-friendly region name, e.g. "DE" -> "Germany". */
export function regionName(region: RegionConfig): string {
  return countryName(region.country) || region.country;
}

/**
 * Absolute site origin used for canonical URLs, hreflang and Open Graph.
 * Prefers an explicit `NEXT_PUBLIC_SITE_URL`, then the Vercel deployment URL,
 * then localhost for local development.
 */
export function getSiteUrl(): string {
  let explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    explicit = explicit.replace(/\/$/, "");
    // Ensure protocol is present — fixes sitemap URLs like "foxzil.com/us"
    // which Google Search Console rejects as invalid.
    if (!/^https?:\/\//i.test(explicit)) {
      explicit = `https://${explicit}`;
    }
    return explicit;
  }
  const vercel = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}
