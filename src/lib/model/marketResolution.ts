/**
 * Deriving store-markets from the legacy advertiser geography fields.
 *
 * Pure, so it can be tested without a database. The caller supplies the set of
 * markets the site is actually configured for.
 */

/** Codes a feed uses for "everywhere", which are not real markets. */
const WORLDWIDE = new Set(["WW", "GLOBAL", "INT", "00", "WORLDWIDE"]);

export interface LegacyGeography {
  countryCodes?: string[] | null;
  countryCode?: string | null;
  region?: string | null;
}

export interface ResolvedMarkets {
  /** Configured markets this advertiser explicitly claims. */
  markets: string[];
  /** Whether a worldwide code was present. */
  worldwide: boolean;
}

/**
 * Markets an advertiser record claims to serve.
 *
 * A worldwide code is **not** expanded into every configured region. Doing so
 * would manufacture the exact "Australian beauty offers appearing in other
 * markets" defect the merchant-market entity exists to fix. It is reported so
 * an operator decides deliberately.
 */
export function resolveMarkets(
  geo: LegacyGeography,
  configuredMarkets: readonly string[],
): ResolvedMarkets {
  const raw = [
    ...(Array.isArray(geo.countryCodes) ? geo.countryCodes : []),
    geo.countryCode ?? "",
    geo.region ?? "",
  ]
    .map((c) => (c || "").trim().toUpperCase())
    .filter(Boolean);

  const worldwide = raw.some((c) => WORLDWIDE.has(c));
  const configured = new Set(configuredMarkets.map((c) => c.toUpperCase()));
  const markets = Array.from(new Set(raw.filter((c) => configured.has(c))));

  return { markets, worldwide };
}
