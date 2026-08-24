import { Advertiser } from "./awin";
import { cleanAdvertiserName } from "./networks";
import { Deal } from "./deals";
import { Transaction } from "./transactions";

export class CFConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CFConfigError";
  }
}

export class CFApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "CFApiError";
  }
}

/**
 * Ensures the API key is available.
 */
export function getCfApiKey(): string {
  const key = process.env.CF_API_KEY;
  if (!key) {
    throw new CFConfigError(
      "CF_API_KEY is not set in environment variables.",
    );
  }
  return key;
}

/**
 * Base generic fetch for Commission Factory API V1.
 */
async function cfFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const apiKey = getCfApiKey();
  const urlParams = new URLSearchParams({ apiKey, ...params });
  const url = `https://api.commissionfactory.com/V1/Affiliate/${endpoint}?${urlParams.toString()}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new CFApiError(
      `CF API error on /${endpoint}: ${res.statusText}`,
      res.status,
    );
  }

  const json = await res.json();
  return json as T[];
}

// ===========================================================================
// Phase 1 — Advertiser Merchants
// ===========================================================================

export interface CFMerchant {
  Id: number;
  DateCreated?: string;
  Name: string;
  Description?: string;
  DisplayUrl?: string;
  AvatarUrl?: string;
  Status?: string; // "Active", "Pending", etc.
  CurrencyCode?: string;
  TargetUrl?: string;
  TrackingUrl?: string;
}

export const CF_DEFAULT_AFFILIATE_ID = "89228";

export function getCfAffiliateId(): string {
  return process.env.CF_AFFILIATE_ID || process.env.NEXT_PUBLIC_CF_AFFILIATE_ID || CF_DEFAULT_AFFILIATE_ID;
}

export function getCfTrackingUrl(merchantId: number, targetUrl?: string): string {
  const affId = getCfAffiliateId();
  if (targetUrl && targetUrl.startsWith("http")) {
    return `https://t.cfjump.com/${affId}/t/${merchantId}?Url=${encodeURIComponent(targetUrl)}`;
  }
  return `https://t.cfjump.com/${affId}/t/${merchantId}`;
}

export function normaliseCfMerchant(m: CFMerchant): Advertiser {
  const statusMap: Record<string, string> = {
    Active: "joined",
    Pending: "pending",
    Suspended: "notjoined",
    Declined: "notjoined",
  };
  const relationship = statusMap[m.Status ?? ""] ?? "joined";
  const trackingUrl = m.TrackingUrl || getCfTrackingUrl(m.Id, m.TargetUrl || m.DisplayUrl);

  return {
    id: m.Id,
    network: "commission-factory",
    name: cleanAdvertiserName(m.Name),
    logoUrl: m.AvatarUrl || null,
    status: m.Status?.toLowerCase() === "active" ? "active" : "inactive",
    relationship,
    region: "AU", // CF is primarily AU, though it has global merchants. Defaulting to AU if not provided in base endpoint.
    countryCode: "AU",
    currencyCode: m.CurrencyCode || "AUD",
    commission: null, // CF base merchant list doesn't readily expose a simplified commission string without the rates endpoint.
    url: trackingUrl,
    description: m.Description || undefined,
    countryCodes: ["AU"],
  };
}

export async function fetchCfMerchants(): Promise<Advertiser[]> {
  const raw = await cfFetch<CFMerchant>("Merchants");
  return raw.map(normaliseCfMerchant);
}

// ===========================================================================
// Phase 2 — Coupons / Deals
// ===========================================================================

export interface CFCoupon {
  Id: number;
  MerchantId: number;
  MerchantName: string;
  MerchantAvatarUrl?: string;
  Description?: string;
  Code?: string;
  TargetUrl?: string;
  StartDate?: string | null;
  EndDate?: string | null;
  TrackingUrl?: string;
}

export function normaliseCfCoupon(c: CFCoupon): Deal {
  const trackingUrl = c.TrackingUrl || getCfTrackingUrl(c.MerchantId, c.TargetUrl);

  return {
    id: c.Id,
    network: "commission-factory",
    title: c.Description || "Special Offer",
    description: c.Description || null,
    advertiser: {
      id: c.MerchantId,
      name: c.MerchantName,
      logoUrl: c.MerchantAvatarUrl || null,
    },
    // A code → voucher (Coupons section); no code → coupon-style "deal".
    type: c.Code ? "voucher" : "deal",
    code: c.Code || null,
    startDate: c.StartDate || null,
    endDate: c.EndDate || null,
    status: "active",
    trackingUrl,
    regionCodes: ["AU"], // Defaulting to AU.
    isExclusive: false,
    discountText: null,
  };
}

export async function fetchCfCoupons(): Promise<Deal[]> {
  const raw = await cfFetch<CFCoupon>("Coupons");
  return raw.map(normaliseCfCoupon);
}

// ===========================================================================
// Phase 2b — Promotions (a separate CF creative type from Coupons)
// ===========================================================================

/**
 * A Commission Factory "Promotion" (Creatives → Promotions). Unlike Coupons,
 * the Promotion type has no structured coupon Code — any code lives inside the
 * free-text terms. We map these to our code-less "deal" type.
 */
export interface CFPromotion {
  Id: number;
  DateCreated?: string;
  DateModified?: string;
  MerchantId: number;
  MerchantName: string;
  MerchantAvatarUrl?: string;
  Description?: string;
  TargetUrl?: string;
  TermsAndConditions?: string;
  StartDate?: string | null;
  EndDate?: string | null;
  TrackingUrl?: string;
}

/**
 * Reserved id band for CF promotions: `p.Id + CF_PROMOTION_ID_OFFSET`.
 *
 * Our deals are keyed on `(network, id)`. The band MUST sit above the
 * auto-generated deal bases in `@/lib/db/deals` so it never collides:
 *   - welcome deals: 1e9 + advertiserId
 *   - brand deals:   2e9 + advertiserId
 *
 * The previous value (2e9) overlapped the brand-deal band, so a CF promotion
 * whose creative `Id` equalled a CF advertiser's `id` collided with that
 * advertiser's brand deal and one silently masked the other on upsert. 3e9
 * gives promotions their own 1e9-wide slot (creative Ids are small integers,
 * far below 1e9). Being >= 1e9 it also stays exempt from `removeStaleDeals`,
 * so a transient `fetchCfPromotions` failure can't wipe existing promotions.
 */
export const CF_PROMOTION_ID_OFFSET = 3_000_000_000;

export function normaliseCfPromotion(p: CFPromotion): Deal {
  const trackingUrl = p.TrackingUrl || getCfTrackingUrl(p.MerchantId, p.TargetUrl);

  return {
    id: p.Id + CF_PROMOTION_ID_OFFSET,
    network: "commission-factory",
    title: p.Description || "Special Offer",
    description: p.TermsAndConditions || p.Description || null,
    advertiser: {
      id: p.MerchantId,
      name: p.MerchantName,
      logoUrl: p.MerchantAvatarUrl || null,
    },
    type: "deal", // CF promotions carry no structured code → coupon-style "deal".
    code: null,
    startDate: p.StartDate || null,
    endDate: p.EndDate || null,
    status: "active",
    trackingUrl,
    regionCodes: ["AU"], // Defaulting to AU.
    isExclusive: false,
    discountText: null,
  };
}

export async function fetchCfPromotions(): Promise<Deal[]> {
  const raw = await cfFetch<CFPromotion>("Promotions");
  return raw.map(normaliseCfPromotion);
}

// ===========================================================================
// Phase 3 — Transactions
// ===========================================================================

export interface CFTransaction {
  Id: number;
  DateCreated?: string;
  OrderDate?: string;
  OrderId?: string;
  MerchantId: number;
  MerchantName: string;
  ReportedCurrencyCode?: string;
  SaleValue?: number;
  Commission?: number;
  Status?: string; // "Approved", "Pending", "Void"
}

function normaliseCfStatus(raw?: string): string {
  if (!raw) return "pending";
  const lower = raw.toLowerCase();
  if (lower === "approved") return "approved";
  if (lower === "void" || lower === "declined" || lower === "rejected") return "declined";
  return "pending";
}

export function normaliseCfTransaction(t: CFTransaction): Transaction {
  return {
    id: t.Id,
    network: "commission-factory",
    advertiserId: t.MerchantId,
    advertiserName: t.MerchantName,
    status: normaliseCfStatus(t.Status),
    commission: t.Commission ?? 0,
    commissionCurrency: t.ReportedCurrencyCode ?? "AUD",
    orderValue: t.SaleValue ?? 0,
    orderCurrency: t.ReportedCurrencyCode ?? "AUD",
    transactionDate: t.OrderDate ?? t.DateCreated ?? new Date().toISOString(),
    clickDate: null, // CF doesn't provide this in the base transaction payload
    customerCountry: "AU", // Default assumption for CF
  };
}

export async function fetchCfTransactions(
  fromDate: string,
  toDate: string,
): Promise<Transaction[]> {
  const params = {
    fromDate,
    toDate,
  };
  // The reporting endpoint for transactions
  const raw = await cfFetch<CFTransaction>("Transactions", params);
  
  // De-duplicate just in case
  const byId = new Map<number, CFTransaction>();
  for (const t of raw) {
    if (!byId.has(t.Id)) byId.set(t.Id, t);
  }

  return Array.from(byId.values()).map(normaliseCfTransaction);
}
