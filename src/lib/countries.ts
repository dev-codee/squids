/**
 * Small, dependency-free helpers for turning 2-letter ISO country codes into
 * human-friendly names and flag emojis. Safe to import on client or server.
 */

const CODE_RE = /^[A-Za-z]{2}$/;

let regionNames: Intl.DisplayNames | null | undefined;

function getRegionNames(): Intl.DisplayNames | null {
  if (regionNames !== undefined) return regionNames;
  try {
    regionNames = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    regionNames = null;
  }
  return regionNames;
}

const GLOBAL_CODES = new Set(["00", "WW", "GLOBAL", "INT", "WORLDWIDE"]);

/**
 * Normalizes a country or locale string into a 2-letter ISO country code or "WW".
 * E.g., "EN_US" -> "US", "cs_CZ" -> "CZ", "00" -> "WW", "GLOBAL" -> "WW", "US" -> "US".
 */
export function normalizeCountryCode(code: string | null | undefined): string {
  if (!code) return "";
  const trimmed = code.trim().toUpperCase();
  if (GLOBAL_CODES.has(trimmed)) return "WW";
  if (CODE_RE.test(trimmed)) return trimmed;
  // Extract 2-letter country code from locale strings like EN_US, cs_CZ, de-DE
  const match = trimmed.match(/(?:^|[-_])([A-Z]{2})$/);
  if (match) {
    const extracted = match[1];
    return GLOBAL_CODES.has(extracted) ? "WW" : extracted;
  }
  return trimmed;
}

/** "PK" -> "Pakistan", "00"/"WW" -> "Worldwide". Falls back to raw code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  const cc = normalizeCountryCode(code);
  if (cc === "WW") return "Worldwide";
  if (!CODE_RE.test(cc)) return code;
  try {
    return getRegionNames()?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** "PK" -> "🇵🇰", "WW"/"00" -> "🌐". Returns a neutral flag for unknown codes. */
export function countryFlag(code: string | null | undefined): string {
  const cc = normalizeCountryCode(code);
  if (cc === "WW") return "🌐";
  if (!cc || !CODE_RE.test(cc)) return "🏳️";
  const codePoints = [...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

/** Convenience: "🇵🇰 Pakistan". */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "";
  return `${countryFlag(code)} ${countryName(code)}`;
}

/**
 * Regex source strings (case-insensitive) that, when found in a store name or
 * domain URL, explicitly signal that the store belongs to a specific country
 * (e.g. "acer.fr" / "Acer Store UK" / "Aosom.fr"). Keyed by ISO country code.
 *
 * Reused by the DB query layer to *exclude* foreign-country stores from a
 * country listing even when a store is tagged worldwide/global.
 */
export const COUNTRY_SIGNAL_PATTERNS: Record<string, string> = {
  FR: "\\.fr\\b|[-\\s]fr\\b",
  DE: "\\.de\\b|[-\\s]de\\b",
  GB: "\\.co\\.uk\\b|\\.uk\\b|[-\\s]uk\\b",
  IT: "\\.it\\b|[-\\s]it\\b",
  ES: "\\.es\\b|[-\\s]es\\b",
  CA: "\\.ca\\b|[-\\s]ca\\b",
  AU: "\\.com\\.au\\b|\\.au\\b|[-\\s]au\\b",
  NL: "\\.nl\\b|[-\\s]nl\\b",
  PL: "\\.pl\\b|[-\\s]pl\\b",
};

/**
 * Detects if a store name or domain URL explicitly specifies a country suffix/TLD
 * like "Aosom.fr" -> "FR", "Acer Store UK" -> "GB", "Acer.de" -> "DE".
 */
export function extractCountryFromNameOrUrl(name?: string | null, url?: string | null): string | null {
  const text = `${name || ""} ${url || ""}`.toLowerCase();
  for (const [code, pattern] of Object.entries(COUNTRY_SIGNAL_PATTERNS)) {
    if (new RegExp(pattern, "i").test(text)) return code;
  }
  return null;
}

/**
 * Returns the country-signal regex source strings for every country *other than*
 * `selected`. Used to exclude e.g. "acer.fr" / "acer.co.uk" from a "DE" listing
 * even when the store is tagged worldwide/global.
 */
export function foreignCountrySignals(selected: string | null | undefined): string[] {
  const cc = normalizeCountryCode(selected);
  return Object.entries(COUNTRY_SIGNAL_PATTERNS)
    .filter(([code]) => code !== cc)
    .map(([, pattern]) => pattern);
}

