/**
 * Awin Transactions API client.
 *
 * Server-side only — reads AWIN_API_TOKEN / AWIN_PUBLISHER_ID from env.
 *
 * Key features:
 *  - Auto-splits date ranges > 31 days into sequential chunks
 *  - Rate-limit retry with exponential backoff (20 calls/min Awin limit)
 *  - In-memory TTL cache to avoid redundant calls
 */

const AWIN_BASE_URL = "https://api.awin.com";
const MAX_RANGE_DAYS = 31;
const CACHE_TTL_MS = 2 * 60_000; // 2 minutes
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Types — raw Awin response
// ---------------------------------------------------------------------------

export interface AwinTransactionAmount {
  amount: number;
  currency: string;
}

export interface AwinTransaction {
  id: number;
  url?: string;
  advertiserId: number;
  publisherId: number;
  commissionStatus: string; // "pending" | "approved" | "declined" | "deleted"
  commissionAmount: AwinTransactionAmount;
  saleAmount: AwinTransactionAmount;
  campaign?: string;
  siteName?: string;
  transactionDate: string;
  clickDate?: string;
  customerCountry?: string;
  clickRefs?: Record<string, string>;
  advertiserName?: string;
}

// ---------------------------------------------------------------------------
// Types — normalised, client-facing
// ---------------------------------------------------------------------------

export interface Transaction {
  id: number;
  /** Affiliate network this transaction belongs to ("awin" | "admitad"). */
  network: string;
  advertiserId: number;
  advertiserName: string;
  status: string;
  commission: number;
  commissionCurrency: string;
  orderValue: number;
  orderCurrency: string;
  transactionDate: string;
  clickDate: string | null;
  customerCountry: string | null;
}

export interface TransactionSummary {
  totalCommission: number;
  totalTransactions: number;
  pendingCount: number;
  approvedCount: number;
  declinedCount: number;
  avgOrderValue: number;
  currency: string;
}

export interface TransactionFacets {
  statuses: string[];
  advertisers: { id: number; name: string }[];
}

export interface TransactionQuery {
  startDate: string;
  endDate: string;
  status?: string;
  advertiserId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface PagedTransactions {
  transactions: Transaction[];
  summary: TransactionSummary;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets: TransactionFacets;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

function getCredentials() {
  const token = process.env.AWIN_API_TOKEN;
  const publisherId = process.env.AWIN_PUBLISHER_ID;
  if (!token || !publisherId) {
    throw new Error(
      "Missing Awin credentials. Set AWIN_API_TOKEN and AWIN_PUBLISHER_ID.",
    );
  }
  return { token, publisherId };
}

// ---------------------------------------------------------------------------
// Date-range chunking (max 31 days per Awin call)
// ---------------------------------------------------------------------------

function chunkDateRange(
  start: Date,
  end: Date,
): { start: Date; end: Date }[] {
  const chunks: { start: Date; end: Date }[] = [];
  let cursor = new Date(start);

  while (cursor < end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + MAX_RANGE_DAYS);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({ start: new Date(cursor), end: new Date(chunkEnd) });
    cursor = new Date(chunkEnd);
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Rate-limit aware fetch with exponential backoff
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = MAX_RETRIES,
): Promise<Response> {
  const res = await fetch(url, { headers, cache: "no-store" });

  if (res.status === 429 && retries > 0) {
    const delay = Math.pow(2, MAX_RETRIES - retries) * 1000; // 1s, 2s, 4s
    console.warn(`Awin rate-limited. Retrying in ${delay}ms…`);
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, headers, retries - 1);
  }

  return res;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const txCache = new Map<string, { at: number; data: AwinTransaction[] }>();

function cacheKey(start: string, end: string): string {
  return `${start}|${end}`;
}

// ---------------------------------------------------------------------------
// Core API call
// ---------------------------------------------------------------------------

async function fetchTransactionChunk(
  startDate: Date,
  endDate: Date,
): Promise<AwinTransaction[]> {
  const key = cacheKey(startDate.toISOString(), endDate.toISOString());
  const cached = txCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const { token, publisherId } = getCredentials();
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    timezone: "UTC",
  });

  const url = `${AWIN_BASE_URL}/publishers/${publisherId}/transactions/?${params}`;
  const res = await fetchWithRetry(url, {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Awin Transactions API responded ${res.status} ${res.statusText}. ${body}`.trim(),
    );
  }

  const data = (await res.json()) as AwinTransaction[];
  if (!Array.isArray(data)) {
    throw new Error("Unexpected Awin Transactions API response shape.");
  }

  txCache.set(key, { at: Date.now(), data });
  return data;
}

// ---------------------------------------------------------------------------
// Public: fetch + merge across date chunks
// ---------------------------------------------------------------------------

export async function fetchTransactions(
  startDate: string,
  endDate: string,
): Promise<Transaction[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date range.");
  }

  const chunks = chunkDateRange(start, end);
  const results = await Promise.all(
    chunks.map((c) =>
      fetchTransactionChunk(c.start, c.end).catch((err) => {
        console.warn("Failed to fetch transaction chunk:", err);
        return [] as AwinTransaction[];
      }),
    ),
  );

  // Merge, de-duplicate by transaction id
  const byId = new Map<number, AwinTransaction>();
  for (const tx of results.flat()) {
    if (!byId.has(tx.id)) byId.set(tx.id, tx);
  }

  return Array.from(byId.values()).map(normaliseTransaction);
}

// ---------------------------------------------------------------------------
// Normalise
// ---------------------------------------------------------------------------

function normaliseTransaction(raw: AwinTransaction): Transaction {
  return {
    id: raw.id,
    network: "awin",
    advertiserId: raw.advertiserId,
    // Awin's transaction feed omits the advertiser name (siteName is OUR
    // publisher site, not the advertiser). The real name is resolved from the
    // advertisers collection at read time — see db/transactions.ts.
    advertiserName: raw.advertiserName || `Advertiser #${raw.advertiserId}`,
    status: (raw.commissionStatus || "unknown").toLowerCase(),
    commission: raw.commissionAmount?.amount ?? 0,
    commissionCurrency: raw.commissionAmount?.currency ?? "USD",
    orderValue: raw.saleAmount?.amount ?? 0,
    orderCurrency: raw.saleAmount?.currency ?? "USD",
    transactionDate: raw.transactionDate,
    clickDate: raw.clickDate || null,
    customerCountry: raw.customerCountry || null,
  };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function buildSummary(transactions: Transaction[]): TransactionSummary {
  let totalCommission = 0;
  let totalOrderValue = 0;
  let pendingCount = 0;
  let approvedCount = 0;
  let declinedCount = 0;
  let currency = "USD";

  for (const tx of transactions) {
    totalCommission += tx.commission;
    totalOrderValue += tx.orderValue;
    if (tx.commissionCurrency) currency = tx.commissionCurrency;

    switch (tx.status) {
      case "pending":
        pendingCount++;
        break;
      case "approved":
        approvedCount++;
        break;
      case "declined":
      case "deleted":
        declinedCount++;
        break;
    }
  }

  return {
    totalCommission: Math.round(totalCommission * 100) / 100,
    totalTransactions: transactions.length,
    pendingCount,
    approvedCount,
    declinedCount,
    avgOrderValue:
      transactions.length > 0
        ? Math.round((totalOrderValue / transactions.length) * 100) / 100
        : 0,
    currency,
  };
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

function buildFacets(all: Transaction[]): TransactionFacets {
  const statuses = new Set<string>();
  const advertiserMap = new Map<number, string>();

  for (const tx of all) {
    if (tx.status) statuses.add(tx.status);
    if (!advertiserMap.has(tx.advertiserId)) {
      advertiserMap.set(tx.advertiserId, tx.advertiserName);
    }
  }

  return {
    statuses: Array.from(statuses).sort(),
    advertisers: Array.from(advertiserMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---------------------------------------------------------------------------
// Query (filter + sort + paginate)
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function queryTransactions(
  all: Transaction[],
  query: TransactionQuery,
): PagedTransactions {
  const facets = buildFacets(all);

  // Filter
  const search = query.search?.trim().toLowerCase() ?? "";
  let filtered = all.filter((tx) => {
    if (query.status && tx.status !== query.status) return false;
    if (query.advertiserId && String(tx.advertiserId) !== query.advertiserId)
      return false;
    if (
      search &&
      !tx.advertiserName.toLowerCase().includes(search) &&
      !String(tx.id).includes(search)
    )
      return false;
    return true;
  });

  // Sort
  const sortBy = query.sortBy || "transactionDate";
  const sortDir = query.sortDir || "desc";
  const mul = sortDir === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortBy];
    const bv = (b as unknown as Record<string, unknown>)[sortBy];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
    if (typeof av === "string" && typeof bv === "string")
      return av.localeCompare(bv) * mul;
    return 0;
  });

  // Summary is computed from filtered set (not just the page)
  const summary = buildSummary(filtered);

  // Paginate
  const pageSize = Math.min(
    Math.max(1, query.pageSize || DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, query.page || 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    transactions: filtered.slice(start, start + pageSize),
    summary,
    page,
    pageSize,
    total,
    totalPages,
    facets,
  };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function toCsv(transactions: Transaction[]): string {
  const headers = [
    "ID",
    "Date",
    "Advertiser",
    "Advertiser ID",
    "Order Value",
    "Commission",
    "Currency",
    "Status",
    "Click Date",
    "Country",
  ];

  const rows = transactions.map((tx) =>
    [
      tx.id,
      tx.transactionDate,
      `"${tx.advertiserName.replace(/"/g, '""')}"`,
      tx.advertiserId,
      tx.orderValue,
      tx.commission,
      tx.commissionCurrency,
      tx.status,
      tx.clickDate ?? "",
      tx.customerCountry ?? "",
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}
