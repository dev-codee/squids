/**
 * Affiliate network registry.
 *
 * Each network gets its own admin dashboard at `/dashboard/networks/<slug>`
 * and contributes to the accumulated earnings view at `/dashboard/networks`.
 * `integrated` marks whether the network's API is wired up yet — un-integrated
 * networks render a "connection pending" scaffold instead of live stats.
 */

export interface NetworkConfig {
  /** URL slug, e.g. "commission-factory". */
  slug: string;
  /** Display name, e.g. "Commission Factory". */
  name: string;
  /** Short description shown on the network dashboard header. */
  description: string;
  /** True once the network's reporting API is connected. */
  integrated: boolean;
  /** Brand accent (Tailwind classes) for badges/headers. */
  accent: string;
}

export const NETWORKS: NetworkConfig[] = [
  {
    slug: "awin",
    name: "Awin",
    description: "Programmes, transactions and commission reporting via the Awin API.",
    integrated: true,
    accent: "bg-orange-100 text-orange-700",
  },
  {
    slug: "admitad",
    name: "Admitad",
    description: "Admitad (Mitgo) campaigns, coupons and action-level commission reporting.",
    integrated: true,
    accent: "bg-indigo-100 text-indigo-700",
  },
  {
    slug: "cj",
    name: "CJ",
    description: "CJ Affiliate (Commission Junction) advertisers and earnings.",
    integrated: false,
    accent: "bg-green-100 text-green-700",
  },
  {
    slug: "commission-factory",
    name: "Commission Factory",
    description: "Commission Factory merchants and performance reporting.",
    integrated: true,
    accent: "bg-blue-100 text-blue-700",
  },
  {
    slug: "kwanko",
    name: "Kwanko",
    description: "Kwanko campaigns and conversion reporting.",
    integrated: true,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    slug: "impact",
    name: "Impact",
    description: "Impact.com partnerships and action-level reporting.",
    integrated: false,
    accent: "bg-purple-100 text-purple-700",
  },
  {
    slug: "webgains",
    name: "WebGains",
    description: "WebGains programmes and commission reporting.",
    integrated: false,
    accent: "bg-teal-100 text-teal-700",
  },
];

/** Look up a single network by slug. */
export function getNetwork(slug: string): NetworkConfig | undefined {
  return NETWORKS.find((n) => n.slug === slug);
}

/**
 * Strips common affiliate network suffixes like " WW", " DE", " Many GEOs", " (US)"
 * which clutter the UI and URL slugs.
 */
export function cleanAdvertiserName(name: string): string {
  if (!name) return name;
  const cleaned = name
    .replace(/\s*[-[(]?\b(WW|GLOBAL|INT|WORLDWIDE|MANY GEOS?|DE|FR|UK|GB|US|ES|IT|CA|AU)\b[\])]?\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || name; // fallback to original if stripped completely
}

/**
 * Canonical public store-page slug for an advertiser name.
 *
 * Single source of truth. Every link, the sitemap and the store page's own
 * canonical must agree, or the sitemap advertises URLs that only 301-redirect
 * and internal links burn a redirect on every click. Market suffixes such as
 * "(WW)" or "- DE" are stripped first via {@link cleanAdvertiserName}, so
 * "invideo - WW" and "invideo" resolve to the same page.
 */
export function storeSlug(name: string): string {
  return cleanAdvertiserName(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
