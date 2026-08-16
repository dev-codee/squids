/**
 * Awin Offers / Promotions API client.
 *
 * Server-side only — reads secrets from environment variables.
 * Mirrors the patterns established in `awin.ts` (caching, error classes, normalisation).
 */

const AWIN_BASE_URL = "https://api.awin.com";

// ---------------------------------------------------------------------------
// Raw Awin response types
// ---------------------------------------------------------------------------

/** Shape of a single promotion as returned by the Awin Offers endpoint. */
export interface AwinPromotion {
  promotionId: number;
  advertiser: {
    id: number;
    name: string;
    logoUrl?: string;
  };
  type: string; // "voucher" | "promotion"
  voucher?: { code: string }; // nested voucher code
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  terms?: string;
  urlTracking?: string;
  url?: string;
  status?: string; // "active" | "expiring-soon" | "upcoming"
  regionCodes?: string[];
  exclusiveOnly?: boolean;
}

/** Awin Offers API paginated response wrapper. */
interface AwinPromotionsResponse {
  data?: AwinPromotion[];
  promotions?: AwinPromotion[];
  pagination?: { total: number };
}

// ---------------------------------------------------------------------------
// Normalised Deal type sent to the client
// ---------------------------------------------------------------------------

export interface DealAdvertiser {
  id: number;
  name: string;
  logoUrl: string | null;
}

/** Which public "deals" section a promotion is placed in. */
export type DealPlacement = "todays" | "lightning" | "limited" | "trending";

/** Coupon sub-category shown on the public coupons page. */
export type CouponSubtype = "code" | "student" | "cashback";

export interface Deal {
  id: number;
  /** Affiliate network this deal belongs to ("awin" | "admitad"). */
  network: string;
  title: string;
  description: string | null;
  advertiser: DealAdvertiser;
  type: "voucher" | "promotion";
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  trackingUrl: string | null;
  regionCodes: string[];

  // --- Admin-managed enrichment (all optional; absent = not set) -----------
  /** Short discount label e.g. "20% OFF", "$15 OFF", "8% CASHBACK". */
  discountText?: string | null;
  /** Product/hero image for deal cards. */
  imageUrl?: string | null;
  /** Original (pre-discount) price for promotions. */
  originalPrice?: number | null;
  /** Sale price for promotions. */
  salePrice?: number | null;
  /** Marks a hand-picked / exclusive offer. */
  isExclusive?: boolean;

  // Voucher/coupon-only enrichment
  /** Coupon sub-category for the coupons page grouping. Defaults to "code". */
  subtype?: CouponSubtype | null;
  /** Cashback rate label e.g. "8% Flat Cashback". */
  cashbackRate?: string | null;
  /** Student verification requirement note. */
  studentVerificationReq?: string | null;

  // Promotion/deal-only enrichment
  /** Which deals section this promotion belongs to. Defaults to "todays". */
  placement?: DealPlacement | null;
  /** Percent of stock already claimed (lightning deals), 0–100. */
  stockPercentage?: number | null;

  /**
   * True when this deal was auto-generated as a generic "welcome" offer for a
   * joined advertiser that had no real deals yet (so the store still surfaces on
   * public pages). Cleared once an admin edits it, and skipped by stale-removal
   * so the network sync never wipes it.
   */
  isAutoWelcome?: boolean;
}

export interface PagedDeals {
  deals: Deal[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Errors (re-export the same classes from awin.ts for consistency)
// ---------------------------------------------------------------------------

import { AwinConfigError, AwinApiError } from "./awin";

export { AwinConfigError, AwinApiError };

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function getCredentials() {
  const token = process.env.AWIN_API_TOKEN;
  const publisherId = process.env.AWIN_PUBLISHER_ID;

  if (!token || !publisherId) {
    throw new AwinConfigError(
      "Missing Awin credentials. Set AWIN_API_TOKEN and AWIN_PUBLISHER_ID.",
    );
  }
  return { token, publisherId };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normaliseDealStatus(raw?: string): string {
  if (!raw) return "active";
  const lower = raw.toLowerCase().replace(/[-_\s]/g, "");
  if (lower === "expiringsoon") return "expiringSoon";
  if (lower === "upcoming") return "upcoming";
  return "active";
}

function normaliseDealType(raw?: string): "voucher" | "promotion" {
  return raw?.toLowerCase() === "voucher" ? "voucher" : "promotion";
}

function normalisePromotion(p: AwinPromotion): Deal {
  return {
    id: p.promotionId,
    network: "awin",
    title: p.title,
    description: p.description || null,
    advertiser: {
      id: p.advertiser.id,
      name: p.advertiser.name,
      logoUrl: p.advertiser.logoUrl || null,
    },
    type: normaliseDealType(p.type),
    code: p.voucher?.code || null,
    startDate: p.startDate || null,
    endDate: p.endDate || null,
    status: normaliseDealStatus(p.status),
    trackingUrl: p.urlTracking || p.url || null,
    regionCodes: p.regionCodes ?? [],
    isExclusive: Boolean(p.exclusiveOnly),
  };
}

// ---------------------------------------------------------------------------
// In-memory cache (15 min TTL)
// ---------------------------------------------------------------------------

const DEALS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  at: number;
  data: Deal[];
  total: number;
}

const dealsCache = new Map<string, CacheEntry>();

function buildCacheKey(filters: DealFilters): string {
  return JSON.stringify(filters);
}

// ---------------------------------------------------------------------------
// Fetch deals from Awin
// ---------------------------------------------------------------------------

export interface DealFilters {
  advertiserIds?: number[];
  status?: string;   // "active" | "expiringSoon" | "upcoming" | "all"
  type?: string;     // "voucher" | "promotion" | "all"
  regionCodes?: string[];
  page?: number;
  pageSize?: number;
}

const DEFAULT_DEAL_PAGE_SIZE = 100;
const MAX_DEAL_PAGE_SIZE = 100;

/**
 * Fetch promotions/offers from the Awin Publisher API.
 *
 * Uses POST with a JSON body containing filter criteria.
 * Results are cached in-memory for 15 minutes.
 */
export async function fetchDeals(filters: DealFilters = {}): Promise<{
  deals: Deal[];
  total: number;
}> {
  const cacheKey = buildCacheKey(filters);
  const cached = dealsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < DEALS_CACHE_TTL_MS) {
    return { deals: cached.data, total: cached.total };
  }

  const { token, publisherId } = getCredentials();

  const pageSize = Math.min(
    Math.max(1, filters.pageSize || DEFAULT_DEAL_PAGE_SIZE),
    MAX_DEAL_PAGE_SIZE,
  );
  const page = Math.max(1, filters.page || 1);

  // Build filter body per Awin's Offers API spec.
  const filterBody: Record<string, unknown> = {
    membership: "joined",
  };
  if (filters.advertiserIds?.length) {
    filterBody.advertiserIds = filters.advertiserIds;
  }
  if (filters.status && filters.status !== "all") {
    // Awin expects e.g. "active", "expiring-soon", "upcoming"
    const statusMap: Record<string, string> = {
      active: "active",
      expiringSoon: "expiring-soon",
      upcoming: "upcoming",
    };
    filterBody.status = statusMap[filters.status] ?? filters.status;
  }
  if (filters.type && filters.type !== "all") {
    filterBody.type = filters.type;
  }
  if (filters.regionCodes?.length) {
    filterBody.regionCodes = filters.regionCodes;
  }

  const body = {
    filters: filterBody,
    pagination: {
      page,
      pageSize,
    },
  };

  const url = `${AWIN_BASE_URL}/publisher/${publisherId}/promotions?accessToken=${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Awin Offers API error (${res.status}):`, text);
    throw new AwinApiError(
      `Awin Offers API responded with ${res.status} ${res.statusText}.`.trim(),
      res.status,
    );
  }

  const json = (await res.json()) as any;

  // The API may return the promotions array at the top level, under 'promotions', or under 'data'.
  const rawPromotions = Array.isArray(json)
    ? (json as AwinPromotion[])
    : (json.data as AwinPromotion[]) ?? (json.promotions as AwinPromotion[]) ?? [];

  const total =
    typeof json === "object" && !Array.isArray(json)
      ? json.pagination?.total ?? json.totalResults ?? rawPromotions.length
      : rawPromotions.length;

  const deals = rawPromotions.map(normalisePromotion);

  dealsCache.set(cacheKey, { at: Date.now(), data: deals, total });

  return { deals, total };
}

// ---------------------------------------------------------------------------
// Query / filter / paginate (for use after fetching a broad dataset)
// ---------------------------------------------------------------------------

export const DEFAULT_DEALS_PAGE_SIZE = 24;
export const MAX_DEALS_PAGE_SIZE = 100;

export interface DealQuery {
  search?: string;
  advertiserId?: number;
  status?: string;
  type?: string;
  country?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Filter and paginate a pre-fetched set of deals.
 *
 * Used when the API already returned a broad set and we need to apply
 * additional client-side filters (e.g. search by title).
 */
export function queryDeals(all: Deal[], query: DealQuery): PagedDeals {
  const search = query.search?.trim().toLowerCase() ?? "";
  const country = query.country?.trim().toUpperCase() ?? "";

  const filtered = all.filter((d) => {
    if (search) {
      const haystack = `${d.title} ${d.advertiser.name} ${d.description ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (query.advertiserId && d.advertiser.id !== query.advertiserId)
      return false;
    if (query.status && query.status !== "all" && d.status !== query.status)
      return false;
    if (query.type && query.type !== "all" && d.type !== query.type)
      return false;
    if (
      country &&
      d.regionCodes.length > 0 &&
      !d.regionCodes.some((rc) => rc.toUpperCase() === country)
    )
      return false;
    return true;
  });

  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_DEALS_PAGE_SIZE),
    MAX_DEALS_PAGE_SIZE,
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    deals: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}
