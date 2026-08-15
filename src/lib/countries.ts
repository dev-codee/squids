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

/**
 * Normalizes a country or locale string into a 2-letter ISO country code.
 * E.g., "EN_US" -> "US", "cs_CZ" -> "CZ", "de_DE" -> "DE", "da_DK" -> "DK", "US" -> "US".
 */
export function normalizeCountryCode(code: string | null | undefined): string {
  if (!code) return "";
  const trimmed = code.trim().toUpperCase();
  if (CODE_RE.test(trimmed)) return trimmed;
  // Extract 2-letter country code from locale strings like EN_US, cs_CZ, de-DE
  const match = trimmed.match(/(?:^|[-_])([A-Z]{2})$/);
  if (match) return match[1];
  return trimmed;
}

/** "PK" -> "Pakistan". Falls back to the raw code if it can't be resolved. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  const cc = normalizeCountryCode(code);
  if (!CODE_RE.test(cc)) return code;
  try {
    return getRegionNames()?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

/** "PK" -> "🇵🇰". Returns a neutral flag for unknown/invalid codes. */
export function countryFlag(code: string | null | undefined): string {
  const cc = normalizeCountryCode(code);
  if (!cc || !CODE_RE.test(cc)) return "🏳️";
  const codePoints = [...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

/** Convenience: "🇵🇰 Pakistan". */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "";
  return `${countryFlag(code)} ${countryName(code)}`;
}

