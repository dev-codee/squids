import { Advertiser } from "./awin";
import { Deal } from "./deals";
import { Transaction } from "./transactions";

export class KwankoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KwankoConfigError";
  }
}

export class KwankoApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "KwankoApiError";
  }
}

/**
 * Ensures the API credentials are available.
 */
export function getKwankoToken(): string {
  const token = process.env.KWANKO_TOKEN;

  if (!token) {
    throw new KwankoConfigError(
      "KWANKO_TOKEN must be set in environment variables.",
    );
  }
  return token;
}

/**
 * Base generic fetch for Kwanko API.
 */
async function kwankoFetch<T>(endpoint: string, params: Record<string, string> = {}, wrapperKey?: string): Promise<T[]> {
  const token = getKwankoToken();
  
  const urlParams = new URLSearchParams(params);
  const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
  const url = `https://api.kwanko.com/${endpoint}${queryString}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new KwankoApiError(
      `Kwanko API error on /${endpoint}: ${res.statusText}`,
      res.status,
    );
  }

  const json = await res.json();
  if (wrapperKey && json[wrapperKey]) {
    return json[wrapperKey] as T[];
  }
  return (Array.isArray(json) ? json : json?.data || json?.results || []) as T[];
}

// ===========================================================================
// Phase 1 — Campaigns / Advertisers
// ===========================================================================

export interface KwankoCampaign {
  id: number;
  name: string;
  description?: string;
  url?: string;
  logo?: string;
  currency?: string;
  languages?: string[];
  // kwanko campaigns are active if returned from all-campaigns usually
}

export function normaliseKwankoCampaign(c: KwankoCampaign): Advertiser {
  return {
    id: c.id,
    network: "kwanko",
    name: c.name || `Campaign #${c.id}`,
    logoUrl: c.logo || null,
    status: "active",
    relationship: "joined",
    region: c.languages?.[0] || "EU",
    countryCode: c.languages?.[0] || "EU",
    currencyCode: c.currency || "EUR",
    commission: null,
    url: c.url || null,
    description: c.description || undefined,
    isGlobal: false,
  };
}

export async function fetchKwankoCampaigns(): Promise<Advertiser[]> {
  const raw = await kwankoFetch<KwankoCampaign>("publishers/all-campaigns", {}, "campaigns");
  return raw.map(normaliseKwankoCampaign);
}

// ===========================================================================
// Phase 2 — Promotions / Deals
// ===========================================================================

export interface KwankoPromotion {
  id?: number | string;
  campaign_id?: number | string;
  campaign_name?: string;
  title?: string;
  description?: string;
  code?: string;
  url?: string;
  start_date?: string;
  end_date?: string;
}

export function normaliseKwankoPromotion(p: KwankoPromotion): Deal {
  const idStr = String(p.id ?? 0);
  const id = parseInt(idStr, 10) || 0;
  
  const campIdStr = String(p.campaign_id ?? 0);
  const campId = parseInt(campIdStr, 10) || 0;

  return {
    id,
    network: "kwanko",
    title: p.title || "Kwanko Offer",
    description: p.description || null,
    advertiser: {
      id: campId,
      name: p.campaign_name || `Campaign #${campId}`,
      logoUrl: null,
    },
    type: p.code ? "voucher" : "promotion",
    code: p.code || null,
    startDate: p.start_date || null,
    endDate: p.end_date || null,
    status: "active",
    trackingUrl: p.url || null,
    regionCodes: ["EU"],
    isExclusive: false,
    discountText: null,
  };
}

export async function fetchKwankoPromotions(): Promise<Deal[]> {
  // Try fetching promotions, but if endpoint doesn't exist, silently return empty
  try {
    const raw = await kwankoFetch<KwankoPromotion>("publishers/promotions", {}, "promotions");
    return raw.map(normaliseKwankoPromotion);
  } catch (error) {
    return [];
  }
}

// ===========================================================================
// Phase 3 — Conversions / Transactions
// ===========================================================================

export interface KwankoConversion {
  kwanko_id: number;
  order_id?: string;
  completed_at?: string;
  state?: string; 
  type?: string; 
  campaign?: {
    id: number;
    name: string;
    currency: string;
  };
  websites_per_language?: Array<{
    spending?: {
      value?: string;
    };
  }>;
}

function normaliseKwankoStatus(raw?: string): string {
  if (!raw) return "pending";
  const lower = raw.toLowerCase();
  if (lower === "approved" || lower === "validated") return "approved";
  if (lower === "declined" || lower === "refused" || lower === "rejected") return "declined";
  return "pending";
}

export function normaliseKwankoConversion(c: KwankoConversion): Transaction {
  const spendingStr = c.websites_per_language?.[0]?.spending?.value || "0";
  const commission = parseFloat(spendingStr) || 0;

  return {
    id: c.kwanko_id,
    network: "kwanko",
    advertiserId: c.campaign?.id || 0,
    advertiserName: c.campaign?.name || `Campaign #${c.campaign?.id}`,
    status: normaliseKwankoStatus(c.state),
    commission: commission,
    commissionCurrency: c.campaign?.currency || "EUR",
    orderValue: commission, // Kwanko API docs don't show sale value, just spending (commission)
    orderCurrency: c.campaign?.currency || "EUR",
    transactionDate: c.completed_at || new Date().toISOString(),
    clickDate: null,
    customerCountry: "EU",
  };
}

// The Kwanko API strictly requires ISO 8601 WITHOUT milliseconds and WITH +00:00 instead of Z.
function formatKwankoDate(isoString: string): string {
  // 1. Remove milliseconds if they exist (e.g. .123Z -> Z)
  // 2. Replace Z with +00:00
  return isoString.replace(/\.\d{3}Z$/, "Z").replace("Z", "+00:00");
}

export async function fetchKwankoConversions(
  fromDate: string,
  toDate: string,
): Promise<Transaction[]> {
  const params = {
    completion_date_from: formatKwankoDate(fromDate),
    completion_date_to: formatKwankoDate(toDate),
  };
  const raw = await kwankoFetch<KwankoConversion>("publishers/conversions", params, "conversions");

  const byId = new Map<number, KwankoConversion>();
  for (const t of raw) {
    if (!byId.has(t.kwanko_id)) byId.set(t.kwanko_id, t);
  }

  return Array.from(byId.values()).map(normaliseKwankoConversion);
}
