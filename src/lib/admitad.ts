/**
 * Admitad API client — OAuth2 authentication + paginated data fetching.
 *
 * Server-side only — reads secrets from environment variables and must never
 * run in the browser.
 *
 * Key features:
 *  - OAuth2 client_credentials token exchange with in-memory caching
 *  - Auto-paginated generic `admitadFetch<T>()` helper
 *  - Custom error classes for config / API errors
 */

const ADMITAD_BASE_URL = "https://api.admitad.com";

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class AdmitadConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdmitadConfigError";
  }
}

export class AdmitadApiError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AdmitadApiError";
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

interface AdmitadCredentials {
  clientId: string;
  clientSecret: string;
  basicAuth: string;
  websiteId: string;
}

function getCredentials(): AdmitadCredentials {
  const clientId = process.env.ADMITAD_CLIENT_ID;
  const clientSecret = process.env.ADMITAD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AdmitadConfigError(
      "Missing Admitad credentials. Set ADMITAD_CLIENT_ID and ADMITAD_CLIENT_SECRET.",
    );
  }

  // ADMITAD_BASIC_AUTH is optional — compute at runtime if not set.
  const basicAuth =
    process.env.ADMITAD_BASIC_AUTH ||
    Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const websiteId = process.env.ADMITAD_WEBSITE_ID || "";

  return { clientId, clientSecret, basicAuth, websiteId };
}

// ---------------------------------------------------------------------------
// OAuth2 token exchange with in-memory caching
// ---------------------------------------------------------------------------

interface TokenEntry {
  accessToken: string;
  expiresAt: number; // Date.now() timestamp
}

let tokenCache: TokenEntry | null = null;

/** Default scopes needed for advertisers, coupons, and statistics. */
const DEFAULT_SCOPES = [
  "advcampaigns",
  "advcampaigns_for_website",
  "coupons",
  "coupons_for_website",
  "statistics",
  "websites",
].join(" ");

/**
 * Obtain (or re-use) a valid Admitad OAuth2 access token.
 *
 * Uses the client_credentials grant type. Tokens are cached in memory and
 * refreshed 60 seconds before they expire.
 */
export async function getAdmitadToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  const { clientId, basicAuth } = getCredentials();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    scope: DEFAULT_SCOPES,
  });

  const res = await fetch(`${ADMITAD_BASE_URL}/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AdmitadApiError(
      `Admitad token exchange failed (${res.status} ${res.statusText}). ${text}`.trim(),
      res.status,
    );
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  if (!json.access_token) {
    throw new AdmitadApiError(
      "Admitad token response missing access_token.",
      502,
    );
  }

  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

// ---------------------------------------------------------------------------
// Generic paginated fetch helper
// ---------------------------------------------------------------------------

/**
 * Admitad paginated response envelope.
 *
 * Most Admitad list endpoints return:
 * ```
 * { results: T[], _meta: { count, limit, offset } }
 * ```
 */
interface AdmitadListResponse<T> {
  results: T[];
  _meta: {
    count: number;
    limit: number;
    offset: number;
  };
}

export interface AdmitadFetchOptions {
  /** Max items per page (Admitad default = 20, max = 500). */
  limit?: number;
  /** Additional query params appended to the URL. */
  params?: Record<string, string>;
  /**
   * Maximum total items to fetch across all pages.
   * Default: Infinity (fetch everything).
   */
  maxItems?: number;
}

/**
 * Authenticated, auto-paginated GET against the Admitad API.
 *
 * Iterates over `?limit=…&offset=…` pages until all results are collected
 * (or `maxItems` is reached).
 *
 * @param path API path (e.g. `/advcampaigns/website/12345/`)
 * @param options Pagination and query param overrides
 * @returns The full array of results across all pages
 */
export async function admitadFetch<T>(
  path: string,
  options: AdmitadFetchOptions = {},
): Promise<T[]> {
  const token = await getAdmitadToken();
  const limit = options.limit ?? 200;
  const maxItems = options.maxItems ?? Infinity;
  const extraParams = options.params ?? {};

  const allResults: T[] = [];
  let offset = 0;

  while (allResults.length < maxItems) {
    const url = new URL(path, ADMITAD_BASE_URL);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AdmitadApiError(
        `Admitad API error at ${path} (${res.status} ${res.statusText}). ${text}`.trim(),
        res.status,
      );
    }

    const json = (await res.json()) as AdmitadListResponse<T>;

    if (!json.results || !Array.isArray(json.results)) {
      throw new AdmitadApiError(
        `Unexpected Admitad response shape at ${path}: missing results array.`,
        502,
      );
    }

    allResults.push(...json.results);

    // Stop if we've fetched all available items or the page was incomplete
    if (
      allResults.length >= json._meta.count ||
      json.results.length < limit
    ) {
      break;
    }

    offset += limit;
  }

  // Trim to maxItems if we over-fetched
  return maxItems < Infinity ? allResults.slice(0, maxItems) : allResults;
}

/**
 * Convenience: get the Admitad website ID, throwing if not configured.
 */
export function getAdmitadWebsiteId(): string {
  const { websiteId } = getCredentials();
  if (!websiteId) {
    throw new AdmitadConfigError(
      "ADMITAD_WEBSITE_ID is not set. Website-scoped endpoints require it.",
    );
  }
  return websiteId;
}

// ===========================================================================
// Phase 2 — Advertiser Campaigns
// ===========================================================================

import type { Advertiser } from "@/lib/awin";

/**
 * Raw Admitad campaign (advcampaign) shape from the API.
 *
 * Field names from https://developers.admitad.com — the exact shape may vary;
 * we handle missing fields gracefully.
 */
export interface AdmitadCampaign {
  id: number;
  name: string;
  site_url?: string;
  gotolink?: string;
  image?: string;
  logo?: string;
  logo_filename?: string;
  description?: string;
  status?: string; // "active", "suspended", etc.
  connection_status?: string; // "active", "pending", "declined"
  currency?: string;
  regions?: { region: string }[];
  categories?: { id: number; name: string }[];
  actions?: {
    id?: number;
    name?: string;
    type?: string; // "sale", "lead"
    payment_size?: string;
    hold_size?: number;
  }[];
  rating?: string;
  avg_hold_time?: number;
  avg_money_transfer_time?: number;
  cr?: number; // conversion rate
  ecpc?: number; // effective cost per click
}

import { normalizeCountryCode } from "@/lib/countries";

/**
 * Normalise an Admitad campaign into our shared `Advertiser` type.
 */
export function normaliseAdmitadCampaign(c: AdmitadCampaign): Advertiser {
  // Extract primary country code from regions
  const primaryRegion = c.regions?.[0]?.region ?? null;
  const countryCode = primaryRegion ? normalizeCountryCode(primaryRegion) : null;

  // Build commission string from actions
  let commission: string | null = null;
  if (c.actions && c.actions.length > 0) {
    const parts = c.actions
      .map((a) => a.payment_size ?? null)
      .filter((p): p is string => Boolean(p));
    commission = parts.length > 0 ? parts.join(", ") : null;
  }

  // Map connection_status → relationship
  const statusMap: Record<string, string> = {
    active: "joined",
    pending: "pending",
    declined: "notjoined",
  };
  const relationship = statusMap[c.connection_status ?? ""] ?? c.connection_status ?? "joined";

  // Logo URL — Admitad may return a relative path or full URL
  let logoUrl: string | null = null;
  if (c.logo) {
    logoUrl = c.logo.startsWith("http") ? c.logo : `https://admitad.com${c.logo}`;
  } else if (c.image) {
    logoUrl = c.image.startsWith("http") ? c.image : `https://admitad.com${c.image}`;
  }

  return {
    id: c.id,
    network: "admitad",
    name: c.name,
    logoUrl,
    status: c.status ?? "active",
    relationship,
    region: primaryRegion,
    countryCode,
    currencyCode: c.currency ?? null,
    commission,
    url: c.gotolink || c.site_url || null,
    description: c.description ?? undefined,
    categories: c.categories?.map((cat) => cat.name) ?? undefined,
    countryCodes: c.regions
      ?.map((r) => normalizeCountryCode(r.region))
      .filter(Boolean) as string[],
  };
}


/**
 * Fetch all Admitad campaigns (advertisers) connected to the publisher website.
 *
 * Requires `ADMITAD_WEBSITE_ID` to be set.
 */
export async function fetchAdmitadCampaigns(): Promise<Advertiser[]> {
  const wID = getAdmitadWebsiteId();
  const raw = await admitadFetch<AdmitadCampaign>(
    `/advcampaigns/website/${wID}/`,
    { limit: 500 },
  );
  return raw.map(normaliseAdmitadCampaign);
}

// ===========================================================================
// Phase 3 — Coupons / Deals
// ===========================================================================

import type { Deal } from "@/lib/deals";

/**
 * Raw Admitad coupon shape from the API.
 */
export interface AdmitadCoupon {
  id: number;
  campaign: {
    id: number;
    name: string;
    logo?: string;
    site_url?: string;
  };
  name: string;
  description?: string;
  promocode?: string;
  type?: string; // "promocode", "action", "offer"
  discount?: string | null; // e.g. "20%", "$15 off"
  date_start?: string;
  date_end?: string;
  species?: string; // "promocode" | "action" | "sale"
  exclusive?: boolean;
  regions?: string[]; // ISO country codes
  landing_page?: string;
  frameset_link?: string;
  categories?: { id: number; name: string }[];
}

/**
 * Normalise an Admitad coupon into our shared `Deal` type.
 */
export function normaliseAdmitadCoupon(c: AdmitadCoupon): Deal {
  // Map Admitad coupon type → our Deal type
  const isVoucher = Boolean(c.promocode) || c.type === "promocode" || c.species === "promocode";

  let logoUrl: string | null = null;
  if (c.campaign.logo) {
    logoUrl = c.campaign.logo.startsWith("http")
      ? c.campaign.logo
      : `https://admitad.com${c.campaign.logo}`;
  }

  return {
    id: c.id,
    network: "admitad",
    title: c.name,
    description: c.description || null,
    advertiser: {
      id: c.campaign.id,
      name: c.campaign.name,
      logoUrl,
    },
    type: isVoucher ? "voucher" : "promotion",
    code: c.promocode || null,
    startDate: c.date_start || null,
    endDate: c.date_end || null,
    status: "active", // Admitad only returns active coupons
    trackingUrl: c.frameset_link || c.landing_page || null,
    regionCodes: c.regions ?? [],
    isExclusive: Boolean(c.exclusive),
    discountText: c.discount || null,
  };
}

/**
 * Fetch all Admitad coupons/deals for the publisher website.
 *
 * Requires `ADMITAD_WEBSITE_ID` to be set.
 */
export async function fetchAdmitadCoupons(): Promise<Deal[]> {
  const wID = getAdmitadWebsiteId();
  const raw = await admitadFetch<AdmitadCoupon>(
    `/coupons/website/${wID}/`,
    { limit: 500 },
  );
  return raw.map(normaliseAdmitadCoupon);
}

// ===========================================================================
// Phase 4 — Transactions (Actions / Statistics)
// ===========================================================================

import type { Transaction } from "@/lib/transactions";

/**
 * Raw Admitad action shape from the statistics/actions endpoint.
 */
export interface AdmitadAction {
  id: number;
  action_id?: number;
  advcampaign_id: number;
  advcampaign_name: string;
  cart?: number | string;
  order_id?: string;
  status?: string; // "pending" (1), "approved"/"confirmed" (2), "declined"/"rejected" (3)
  status_updated?: string;
  payment: number;
  currency?: string;
  action_date?: string;
  closing_date?: string;
  click_date?: string;
  subid?: string;
  subid1?: string;
  website_name?: string;
  action?: string; // "sale", "lead"
  comment?: string;
  country_code?: string;
}

/**
 * Map Admitad status values → our normalised status.
 */
function normaliseAdmitadStatus(raw?: string): string {
  if (!raw) return "pending";
  const lower = raw.toLowerCase();
  if (lower === "pending" || lower === "1" || lower === "open" || lower === "hold") return "pending";
  if (lower === "approved" || lower === "confirmed" || lower === "2") return "approved";
  if (lower === "declined" || lower === "rejected" || lower === "3") return "declined";
  return "pending";
}

/**
 * Normalise an Admitad action into our shared `Transaction` type.
 *
 * Unlike Awin, Admitad actions include the campaign name, so we store it
 * directly — no read-time advertiser name resolution needed.
 */
export function normaliseAdmitadAction(a: AdmitadAction): Transaction {
  return {
    id: a.action_id ?? a.id,
    network: "admitad",
    advertiserId: a.advcampaign_id,
    advertiserName: a.advcampaign_name || `Campaign #${a.advcampaign_id}`,
    status: normaliseAdmitadStatus(a.status),
    commission: a.payment ?? 0,
    commissionCurrency: a.currency ?? "USD",
    orderValue: typeof a.cart === "number" ? a.cart : Number(a.cart) || 0,
    orderCurrency: a.currency ?? "USD",
    transactionDate: a.action_date ?? new Date().toISOString(),
    clickDate: a.click_date || null,
    customerCountry: a.country_code || null,
  };
}

/**
 * Fetch Admitad actions (individual conversions) for a date range.
 *
 * Uses `/statistics/actions/` which is account-level (does NOT require
 * ADMITAD_WEBSITE_ID, though you can optionally scope by website).
 *
 * @param startDate ISO date string
 * @param endDate ISO date string
 */
export async function fetchAdmitadActions(
  startDate: string,
  endDate: string,
): Promise<Transaction[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new AdmitadApiError("Invalid date range for Admitad actions.", 400);
  }

  // Admitad expects dd.MM.yyyy format for date_start/date_end
  const fmt = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;

  const params: Record<string, string> = {
    date_start: fmt(start),
    date_end: fmt(end),
  };

  // Optionally scope to website if configured
  const websiteId = process.env.ADMITAD_WEBSITE_ID;
  if (websiteId) {
    params.website = websiteId;
  }

  const raw = await admitadFetch<AdmitadAction>(
    `/statistics/actions/`,
    { limit: 500, params },
  );

  // De-duplicate by action_id (Admitad may return overlapping results)
  const byId = new Map<number, AdmitadAction>();
  for (const a of raw) {
    const key = a.action_id ?? a.id;
    if (!byId.has(key)) byId.set(key, a);
  }

  return Array.from(byId.values()).map(normaliseAdmitadAction);
}
