/**
 * Awin API client + typed responses.
 *
 * Only server-side code should import this module — it reads secrets from
 * environment variables and must never run in the browser.
 */

import { cleanAdvertiserName } from "./networks";

const AWIN_BASE_URL = "https://api.awin.com";

/** Shape of a single programme as returned by the Awin programmes endpoint. */
export interface AwinProgramme {
  id: number;
  name: string;
  displayUrl?: string;
  clickThroughUrl?: string;
  logoUrl?: string;
  currencyCode?: string;
  status?: string; // e.g. "active"
  relationship?: string; // e.g. "joined", "pending", "notjoined"
  primaryRegion?: {
    countryCode?: string;
    name?: string;
  };
  validDomains?: { domain?: string }[];
  commissionRange?: {
    min?: number;
    max?: number;
    type?: string;
  }[];
}

/** Normalised advertiser shape sent to the client. */
export interface Advertiser {
  id: number;
  /** Affiliate network this advertiser belongs to ("awin" | "admitad"). */
  network: string;
  name: string;
  logoUrl: string | null;
  status: string | null;
  relationship: string | null;

  // Manual Store Meta overrides
  description?: string;
  categories?: string[];
  bannerUrl?: string;
  avgSavings?: string;
  rating?: number;
  isFlagship?: boolean;
  /** Internal-only flag marking an advertiser as PPC. Never shown publicly. */
  isPPC?: boolean;
  /**
   * True when this advertiser was created manually by an admin (not sourced from
   * a network feed). Manual advertisers are never present in any network's API
   * response, so stale-removal must skip them — otherwise the next sync would
   * delete them.
   */
  isManual?: boolean;

  region: string | null;
  countryCode: string | null;
  countryCodes?: string[];
  currencyCode: string | null;
  commission: string | null;
  url: string | null;

  /** Dynamically populated count of active deals */
  dealCount?: number;

  /** AI-generated store page content (Claude). Cached so tokens are spent once. */
  aiStorePage?: import("@/lib/ai/storeContent").StorePageContent | null;
  /** ISO timestamp the store page content was generated. */
  aiStorePageAt?: string | null;

  // --- Phase 2: Per-language AI store page ---------------------------------
  /** AI-generated store page content keyed by locale ("en", "de", "fr", "es", "it"). */
  aiStorePageByLang?: Record<string, import("@/lib/ai/storeContent").StorePageContent> | null;
  /** ISO timestamp keyed by locale. */
  aiStorePageAtByLang?: Record<string, string> | null;

  /** SEO Title (custom or AI generated with max discount analysis). */
  seoTitle?: string | null;
  /** Short non-fluffy SEO Description. */
  seoDescription?: string | null;
  /** Maximum discount percentage (e.g. "50%"). */
  maxDiscount?: string | null;
}

export class AwinConfigError extends Error {}
export class AwinApiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

interface AwinCredentials {
  token: string;
  publisherId: string;
}

function getCredentials(): AwinCredentials {
  const token = process.env.AWIN_API_TOKEN;
  const publisherId = process.env.AWIN_PUBLISHER_ID;

  if (!token || !publisherId) {
    throw new AwinConfigError(
      "Missing Awin credentials. Set AWIN_API_TOKEN and AWIN_PUBLISHER_ID.",
    );
  }
  return { token, publisherId };
}

/** Turn a raw Awin commission range into a short human-readable string. */
function formatCommission(programme: AwinProgramme): string | null {
  const ranges = programme.commissionRange;
  if (!ranges || ranges.length === 0) return null;

  const parts = ranges
    .map((r) => {
      if (r.min == null && r.max == null) return null;
      const suffix = r.type === "percentage" ? "%" : "";
      if (r.min != null && r.max != null && r.min !== r.max) {
        return `${r.min}–${r.max}${suffix}`;
      }
      const value = r.max ?? r.min;
      return `${value}${suffix}`;
    })
    .filter((p): p is string => Boolean(p));

  return parts.length ? parts.join(", ") : null;
}

/**
 * Map a raw Awin programme onto our normalised Advertiser type.
 *
 * @param fallbackRelationship Used when the Awin response doesn't include a
 *   per-programme `relationship` field. Since we query one relationship at a
 *   time, the queried value is a reliable stamp (e.g. "joined" / "pending").
 */
export function normaliseProgramme(
  programme: AwinProgramme,
  fallbackRelationship?: string,
): Advertiser {
  return {
    id: programme.id,
    network: "awin",
    name: cleanAdvertiserName(programme.name),
    logoUrl: programme.logoUrl || null,
    status: programme.validDomains?.length ? "active" : "inactive",
    relationship: programme.relationship || fallbackRelationship || null,
    region: programme.primaryRegion?.name || null,
    countryCode: programme.primaryRegion?.countryCode || null,
    countryCodes: programme.primaryRegion?.countryCode ? [programme.primaryRegion.countryCode] : [],
    currencyCode: programme.currencyCode || null,
    commission: formatCommission(programme),
    url:
      programme.clickThroughUrl ||
      (process.env.AWIN_PUBLISHER_ID
        ? `https://www.awin1.com/awclick.php?mid=${programme.id}&id=${process.env.AWIN_PUBLISHER_ID}`
        : programme.displayUrl || null),
  };
}

/**
 * Simple in-memory TTL cache for programme responses.
 *
 * The programmes payload can be several MB per relationship, which exceeds
 * Next.js's 2MB fetch-cache limit — so we cache here in the module instead of
 * relying on `next: { revalidate }`. Lives for the lifetime of the server
 * instance; on serverless it's a best-effort per-instance cache.
 */
const PROGRAMME_CACHE_TTL_MS = 60_000;
const programmeCache = new Map<string, { at: number; data: Advertiser[] }>();

/**
 * Fetch the programmes (advertisers) the publisher has a relationship with.
 *
 * @param relationship One of "joined" | "pending" | "notjoined". Defaults to "joined".
 */
export async function fetchProgrammes(
  relationship = "joined",
): Promise<Advertiser[]> {
  const cached = programmeCache.get(relationship);
  if (cached && Date.now() - cached.at < PROGRAMME_CACHE_TTL_MS) {
    return cached.data;
  }

  const { token, publisherId } = getCredentials();

  const url = `${AWIN_BASE_URL}/publishers/${publisherId}/programmes?relationship=${encodeURIComponent(
    relationship,
  )}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    // Payload exceeds Next's 2MB data-cache limit; we cache in-memory instead.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AwinApiError(
      `Awin API responded with ${res.status} ${res.statusText}. ${body}`.trim(),
      res.status,
    );
  }

  const data = (await res.json()) as AwinProgramme[];
  if (!Array.isArray(data)) {
    throw new AwinApiError("Unexpected Awin API response shape.", 502);
  }

  const advertisers = data.map((p) => normaliseProgramme(p, relationship));
  programmeCache.set(relationship, { at: Date.now(), data: advertisers });
  return advertisers;
}

/** Relationships the UI lets you browse/filter by. */
export const DEFAULT_RELATIONSHIPS = ["joined", "pending"] as const;

/**
 * Fetch programmes across several relationships and merge them into one list.
 *
 * This is what powers the status filter — without both "joined" and "pending"
 * results, the status dropdown would only ever have a single option.
 */
export async function fetchProgrammesForRelationships(
  relationships: readonly string[] = DEFAULT_RELATIONSHIPS,
): Promise<Advertiser[]> {
  const results = await Promise.all(
    relationships.map((rel) =>
      // A missing relationship for this account shouldn't break the whole page.
      fetchProgrammes(rel).catch((err) => {
        console.warn(`Failed to fetch "${rel}" programmes:`, err);
        return [] as Advertiser[];
      }),
    ),
  );

  // Merge, de-duplicating by advertiser id (a joined result wins over pending).
  const byId = new Map<number, Advertiser>();
  for (const advertiser of results.flat()) {
    if (!byId.has(advertiser.id)) byId.set(advertiser.id, advertiser);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// --- Filtering + pagination -------------------------------------------------

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

export interface AdvertiserQuery {
  search?: string;
  region?: string;
  relationship?: string;
  category?: string;
  /** 2-letter ISO country code to match against the advertiser's region. */
  country?: string;
  page?: number;
  pageSize?: number;
  requireDeals?: boolean;
}

export interface AdvertiserFacets {
  regions: string[];
  relationships: string[];
  /** Distinct ISO country codes present in the dataset (for the geo selector). */
  countries: string[];
  categories?: string[];
}


export interface PagedAdvertisers {
  advertisers: Advertiser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets: AdvertiserFacets;
}

import { normalizeCountryCode } from "@/lib/countries";

/** Distinct, sorted values for the filter dropdowns (from the full dataset). */
function buildFacets(all: Advertiser[]): AdvertiserFacets {
  const regions = new Set<string>();
  const relationships = new Set<string>();
  const countries = new Set<string>();
  for (const a of all) {
    if (a.region) regions.add(a.region);
    if (a.relationship) relationships.add(a.relationship);
    if (a.countryCode) {
      const norm = normalizeCountryCode(a.countryCode);
      if (norm) countries.add(norm);
    }
  }
  return {
    regions: Array.from(regions).sort(),
    relationships: Array.from(relationships).sort(),
    countries: Array.from(countries).sort(),
  };
}


/**
 * Apply search/region/status filters and slice the result to a single page.
 *
 * Facets are computed from the *unfiltered* list so the dropdowns always offer
 * every option, regardless of the current filters.
 */
export function queryAdvertisers(
  all: Advertiser[],
  query: AdvertiserQuery,
): PagedAdvertisers {
  const facets = buildFacets(all);

  const search = query.search?.trim().toLowerCase() ?? "";
  const country = query.country?.trim().toUpperCase() ?? "";
  const filtered = all.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search)) return false;
    if (query.region && a.region !== query.region) return false;
    if (query.relationship && a.relationship !== query.relationship)
      return false;
    if (country) {
      const isGlobal =
        a.region?.toLowerCase() === "global" ||
        a.region?.toLowerCase() === "worldwide" ||
        a.region === "00" ||
        a.countryCode === "00" ||
        normalizeCountryCode(a.countryCode) === "WW" ||
        normalizeCountryCode(a.region) === "WW" ||
        ["WW", "GLOBAL", "INT", "00"].includes(a.countryCode?.toUpperCase() || "");

      const hasCountry = a.countryCodes
        ? a.countryCodes.some((c) => normalizeCountryCode(c) === normalizeCountryCode(country))
        : normalizeCountryCode(a.countryCode) === normalizeCountryCode(country);

      if (!hasCountry && !isGlobal) {
        return false;
      }
    }

    return true;
  });

  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    advertisers: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
    facets,
  };
}
