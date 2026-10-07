/**
 * Store Data Provider
 *
 * Loads data for the public store pages (`/[store]`, `/[store]/coupons`,
 * `/[store]/deals`) entirely from MongoDB (Awin-synced + admin-managed).
 *
 * There is NO mock data. A store maps to an Awin advertiser (by slug); its
 * coupons and deals come from the `deals` collection. Sections without a data
 * source yet (products, reviews, FAQs, guides, price comparison) return empty
 * and the pages hide them until their Phase lands (see STORE_PAGES_PLAN.md).
 */

import { cache } from "react";
import {
  getAdvertiserBySlug,
  slugifyAdvertiserName,
  ensureAdvertiserStorePage,
  getRelatedAdvertisers,
  getShowcaseAdvertisersFromDb,
} from "@/lib/db/advertisers";
import { generateStoreSeoContent } from "@/lib/ai/storeSeo";
import type { StorePageContent } from "@/lib/ai/storeContent";
import { getDealsFromDb, ensureDealAiContent } from "@/lib/db/deals";

import { getProductsFromDb } from "@/lib/db/products";
import { getReviewsFromDb } from "@/lib/db/reviews";
import { getFAQsFromDb } from "@/lib/db/faqs";
import { getGuidesFromDb } from "@/lib/db/buyingGuides";
import type { Advertiser } from "@/lib/awin";
import { cleanAdvertiserName } from "@/lib/networks";
import type { Deal } from "@/lib/deals";
import { dealDisplayTitle, dealDisplayDescription } from "@/lib/deals";
import type { Product } from "@/lib/products";
import { getRegionConfig, formatMoney, type RegionConfig } from "@/lib/regions";
import { convert, getUsdRates, type UsdRates } from "@/lib/fx";

// ---------------------------------------------------------------------------
// Public view-model types (consumed by src/components/store/*)
// ---------------------------------------------------------------------------

export interface CouponItem {
  id: string;
  title: string;
  code: string | null;
  discount: string;
  type: "code" | "student" | "cashback";
  description: string;
  verified: boolean;
  expiryDate: string | null;
  /** Last-edited timestamp (ISO), shown as "Updated" on the card. */
  updatedAt: string | null;
  isExclusive?: boolean;
  cashbackRate?: string;
  studentVerificationReq?: string;
  affiliateUrl?: string;
  evidenceStatus?: "checkout-tested" | "merchant-listed" | "community-reported";
  checkedAt?: string | null;
  conditions?: import("./model/promotion").PromotionConditions | null;
  currency?: string | null;
  terms?: string | null;
  sourceUrl?: string | null;
  delivery?: import("./model/delivery").DeliveryRule | null;
}

export interface DealItem {
  id: string;
  title: string;
  description: string;
  discount: string;
  originalPrice?: string;
  salePrice?: string;
  type: "todays" | "lightning" | "limited" | "trending";
  imageUrl?: string;
  expiryDate: string | null;
  /** Last-edited timestamp (ISO), shown as "Updated" on the card. */
  updatedAt: string | null;
  badge?: string;
  isExclusive?: boolean;
  stockPercentage?: number;
  endsInSeconds?: number;
  affiliateUrl: string;
}

export interface ProductFeedItem {
  id: string;
  title: string;
  category: string;
  image: string;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  affiliateUrl: string;
}

export interface PriceComparisonItem {
  id: string;
  productName: string;
  category: string;
  image: string;
  currentStorePrice: number;
  competitors: {
    storeName: string;
    price: number;
    inStock: boolean;
    url: string;
  }[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BuyingGuideItem {
  id: string;
  title: string;
  readTime: string;
  summary: string;
  category: string;
  author: string;
  date: string;
}

export interface RelatedStoreItem {
  slug: string;
  name: string;
  logoUrl: string | null;
}

export interface StoreReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  comment: string;
  verifiedBuyer: boolean;
}

export interface StoreData {
  slug: string;
  name: string;
  /** Backing advertiser record — used to key follow-store alert subscriptions. */
  network: string;
  advertiserId: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  rating: number;
  totalReviews: number;
  activeCouponsCount: number;
  activeDealsCount: number;
  avgSavings: string | null;
  description: string;
  websiteUrl: string;
  officialUrl?: string | null;
  policyUrls?: { delivery?: string; returns?: string; payment?: string; support?: string; policies?: string };
  categories: string[];
  /** Coupons — voucher offers with a code. */
  coupons: CouponItem[];
  /** Deals — coupon-style offers without a code. */
  deals: CouponItem[];
  /** Promotions — product promotions with image/price. */
  promotions: DealItem[];
  products: ProductFeedItem[];
  priceComparisons: PriceComparisonItem[];
  faqs: FAQItem[];
  buyingGuides: BuyingGuideItem[];
  reviews: StoreReviewItem[];
  relatedStores: RelatedStoreItem[];
  latestDiscounts: {
    id: string;
    title: string;
    discount: string;
    updatedTime: string;
    type: string;
  }[];
  /** AI-generated store page content (hero, trust, shipping, FAQ, …). */
  aiStorePage: StorePageContent | null;
  /** SEO Title (custom or AI-generated with max discount analysis). */
  seoTitle?: string | null;
  /** Short non-fluffy SEO Description. */
  seoDescription?: string | null;
  /** Maximum discount percentage (e.g. "50%"). */
  maxDiscount?: string | null;
  /** Responsible editor and actual review timestamp (§4). */
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  syncedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Mapping helpers (DB Deal -> public view models)
// ---------------------------------------------------------------------------

/**
 * Convert a stored deal price (in the advertiser's `sourceCurrency`) into the
 * visitor's region currency and format it for that region's locale.
 */
function formatPrice(
  value: number,
  sourceCurrency: string | null | undefined,
  region: RegionConfig,
  rates: UsdRates,
): string {
  const from = sourceCurrency || "USD";
  const converted = convert(value, from, region.currency, rates);
  return formatMoney(converted, region);
}

/** Normalize a last-edited stamp (Date or ISO string) to an ISO string, or null. */
function toIsoDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Sanitize an expiry date from the network feed.
 * Returns null for absent, unparseable, past, or suspiciously far-future dates
 * (> 2 years from now) — the latter are placeholder values from some networks.
 */
function sanitizeEndDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const twoYearsOut = new Date();
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);
  if (d > twoYearsOut) return null;
  return value;
}

/** Seconds remaining until an ISO end date, or undefined if past/absent. */
function secondsUntil(endDate: string | null | undefined): number | undefined {
  if (!endDate) return undefined;
  const ms = new Date(endDate).getTime() - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : undefined;
}

import { localeForCountry } from "@/i18n";
import { languageNameForLocale } from "@/lib/ai/languageNames";
import { resolveAffiliateTrackingUrl } from "@/lib/affiliateUrls";

function resolveAffiliateLink(
  network?: string | null,
  advertiserId?: number | string | null,
  url?: string | null,
): string {
  return resolveAffiliateTrackingUrl(network, advertiserId, url);
}

function couponFromDeal(deal: Deal, fallbackUrl: string, locale?: string): CouponItem {
  const affUrl = resolveAffiliateLink(deal.network, deal.advertiser.id, deal.trackingUrl || fallbackUrl);
  return {
    id: `${deal.network}:${deal.id}`,
    title: dealDisplayTitle(deal, locale),
    code: deal.code,
    discount: deal.discountText || "",
    type: deal.subtype || "code",
    description: dealDisplayDescription(deal, locale),
    verified: Boolean(deal.promotion?.evidenceStatus === "checkout-tested" && deal.promotion.evidenceCheckedAt && deal.promotion.evidenceCheckedBy && deal.promotion.evidenceSourceUrl),
    evidenceStatus:
      deal.promotion?.evidenceStatus === "checkout-tested" && deal.promotion.evidenceCheckedAt && deal.promotion.evidenceCheckedBy && deal.promotion.evidenceSourceUrl
        ? "checkout-tested" : deal.promotion?.evidenceStatus === "community-reported" ? "community-reported" : "merchant-listed",
    checkedAt: toIsoDate(deal.promotion?.evidenceCheckedAt),
    conditions: deal.promotion?.conditions,
    currency: deal.promotion?.benefit.currency,
    terms: deal.terms,
    sourceUrl: safeOfficialUrl(deal.promotion?.evidenceSourceUrl || deal.sourceUrl),
    delivery: deal.delivery,
    expiryDate: sanitizeEndDate(deal.endDate),
    updatedAt: toIsoDate(deal.sourceUpdatedAt || deal.fetchedAt || deal.syncedAt),
    isExclusive: deal.isExclusive,
    cashbackRate: deal.cashbackRate || undefined,
    studentVerificationReq: deal.studentVerificationReq || undefined,
    affiliateUrl: affUrl,
  };
}

function dealFromDeal(
  deal: Deal,
  fallbackUrl: string,
  sourceCurrency: string | null | undefined,
  region: RegionConfig,
  rates: UsdRates,
  locale?: string,
): DealItem {
  const placement = deal.placement || "todays";

  let badge: string | undefined;
  if (deal.isExclusive) badge = "Exclusive";
  else if (deal.stockPercentage != null) badge = `${deal.stockPercentage}% Claimed`;

  const affUrl = resolveAffiliateLink(deal.network, deal.advertiser.id, deal.trackingUrl || fallbackUrl);

  return {
    id: `${deal.network}:${deal.id}`,
    title: dealDisplayTitle(deal, locale),
    description: dealDisplayDescription(deal, locale),
    discount: deal.discountText || "",
    originalPrice:
      deal.originalPrice != null
        ? formatPrice(deal.originalPrice, sourceCurrency, region, rates)
        : undefined,
    salePrice:
      deal.salePrice != null
        ? formatPrice(deal.salePrice, sourceCurrency, region, rates)
        : undefined,
    type: placement,
    imageUrl: deal.imageUrl || undefined,
    expiryDate: sanitizeEndDate(deal.endDate),
    updatedAt: toIsoDate(deal.sourceUpdatedAt || deal.fetchedAt || deal.syncedAt),
    badge,
    isExclusive: Boolean(deal.isExclusive),
    stockPercentage: deal.stockPercentage ?? undefined,
    endsInSeconds: placement === "lightning" ? secondsUntil(deal.endDate) : undefined,
    affiliateUrl: affUrl,
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**

 * Load a store's public data from MongoDB. Returns `null` when the slug does
 * not resolve to a known advertiser (caller should render `notFound()`).
 */
async function loadStoreDataUncached(
  slug: string,
  country?: string,
): Promise<StoreData | null> {
  const advertiser = await getAdvertiserBySlug(slug, country);

  if (!advertiser) return null;

  if (advertiser.name) {
    advertiser.name = cleanAdvertiserName(advertiser.name);
  }

  // Region context: prices are converted from the advertiser's native currency
  // into the URL region's currency (e.g. /de -> EUR) and formatted for its locale.
  const region = getRegionConfig(country);
  const locale = localeForCountry(country || "US");
  const rates = await getUsdRates();

  const canonicalSlug = slugifyAdvertiserName(advertiser.name);
  const websiteUrl = resolveAffiliateLink(advertiser.network, advertiser.id, advertiser.url);

  const storeMeta = {
    slug: canonicalSlug,
    rating: advertiser.rating || 0,
    bannerUrl: advertiser.bannerUrl || null,
    avgSavings: advertiser.avgSavings || null,
    description: advertiser.description || "",
    categories: advertiser.reviewedCategories ?? (advertiser.categoriesReviewedAt ? advertiser.categories ?? [] : []),
  };

  const finalSlug = storeMeta.slug;

  // Safe wrapper for DB queries
  async function safeQuery<T>(queryFn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await queryFn();
    } catch (e) {
      console.warn("MongoDB error during safeQuery:", e);
      return fallback;
    }
  }

  const allDeals: Deal[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await getDealsFromDb({ advertiserId: advertiser.id, network: advertiser.network, country, status: "all", type: "all", page, pageSize: 100 });
    if (!result) break;
    allDeals.push(...result.deals);
    totalPages = result.totalPages;
    page++;
  } while (page <= totalPages);
  if (!allDeals.length) return null;

  // Ordering within every section: exclusive offers pinned to the very top,
  // then the most recently edited first. `syncedAt` is the last-edited stamp
  // (bumped on create/admin-edit, untouched by network sync). Array.sort is
  // stable, so items with equal keys keep their prior order.
  const editedTime = (d: Deal) => {
    const t = d.syncedAt ? new Date(d.syncedAt).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  };
  const byExclusiveThenRecent = (a: Deal, b: Deal) => {
    const ex = Number(Boolean(b.isExclusive)) - Number(Boolean(a.isExclusive));
    if (ex !== 0) return ex;
    return editedTime(b) - editedTime(a);
  };

  const deduped = allDeals;

  // Coupons: vouchers that have an actual non-empty code.
  const coupons = deduped
    .filter((d) => d.type === "voucher" && d.code != null && d.code.trim() !== "")
    .sort(byExclusiveThenRecent)
    .map((d) => couponFromDeal(d, websiteUrl, locale));

  // Deals: coupon-style offers without a code (type "deal" OR vouchers with null code).
  const deals = deduped
    .filter((d) => d.type === "deal" || (d.type === "voucher" && (!d.code || d.code.trim() === "")))
    .sort(byExclusiveThenRecent)
    .map((d) => couponFromDeal(d, websiteUrl, locale));

  // Promotions: product promotions with image/price (rendered as deal boxes).
  const promotions = deduped
    .filter((d) => d.type === "promotion")
    .sort(byExclusiveThenRecent)
    .map((d) => dealFromDeal(d, websiteUrl, advertiser.currencyCode, region, rates, locale));

  const productsResult = await safeQuery(
    () => getProductsFromDb({ advertiserId: advertiser!.id, network: advertiser!.network, country, page: 1, pageSize: 50 }),
    { products: [], page: 1, pageSize: 50, total: 0, totalPages: 1 }
  );
  
  const products: ProductFeedItem[] = productsResult.products.map(p => ({
    id: String(p.id),
    title: p.title,
    category: p.category || "",
    image: p.imageUrl || "",
    originalPrice: p.originalPrice || 0,
    salePrice: p.salePrice || 0,
    discountPercentage: p.discountPercentage || 0,
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    inStock: p.inStock,
    affiliateUrl: p.trackingUrl || websiteUrl,
  }));

  const reviewsResult = await safeQuery(
    () => getReviewsFromDb({ advertiserId: advertiser!.id, page: 1, pageSize: 100 }),
    { items: [], page: 1, pageSize: 100, total: 0, totalPages: 1 }
  );
  const reviews: StoreReviewItem[] = reviewsResult.items.map(r => ({
    id: String(r.id),
    author: r.author,
    rating: r.rating,
    date: r.date,
    title: r.title,
    comment: r.comment,
    verifiedBuyer: r.verifiedBuyer,
  }));

  let finalRating = storeMeta.rating || 0;
  if (reviews.length > 0) {
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    finalRating = Number((sum / reviews.length).toFixed(1));
  }

  const faqsResult = await safeQuery(
    () => getFAQsFromDb({ advertiserId: advertiser!.id, page: 1, pageSize: 50 }),
    { items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 }
  );
  const faqs: FAQItem[] = faqsResult.items.map(f => ({
    question: f.question,
    answer: f.answer,
  }));

  const guidesResult = await safeQuery(
    () => getGuidesFromDb({ advertiserId: advertiser!.id, page: 1, pageSize: 20 }),
    { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }
  );
  const buyingGuides: BuyingGuideItem[] = guidesResult.items.map(g => ({
    id: String(g.id),
    title: g.title,
    readTime: g.readTime,
    summary: g.summary,
    category: g.category || "",
    author: g.author || "",
    date: g.date || "",
  }));

  // Similar stores, in three tiers so the row is never near-empty:
  //   1. the editor's pinned picks, in their order;
  //   2. stores sharing a category with this one;
  //   3. the region's flagship stores, as a last resort.
  // A visitor who has only ever opened this one store still sees a full row,
  // which the per-browser "recently viewed" strip cannot give them.
  const MIN_SIMILAR = 4;
  const MAX_SIMILAR = 8;

  const manualSlugs = (advertiser.similarStoreSlugs ?? [])
    .map((slug) => slug.trim().toLowerCase())
    .filter((slug) => slug && slug !== finalSlug);

  const manualAdvertisers = (
    await Promise.all(
      manualSlugs
        .slice(0, MAX_SIMILAR)
        .map((slug) => safeQuery(() => getAdvertiserBySlug(slug, country), null)),
    )
  ).filter((a): a is Advertiser => Boolean(a));

  const relatedAdvertisers = await safeQuery(
    () =>
      getRelatedAdvertisers(
        storeMeta.categories,
        { id: advertiser!.id, network: advertiser!.network ?? "awin" },
        country,
        MAX_SIMILAR,
      ),
    [] as Advertiser[],
  );

  const picked: Advertiser[] = [];
  const seenSlugs = new Set<string>([finalSlug]);
  const add = (list: readonly Advertiser[]) => {
    for (const a of list) {
      if (picked.length >= MAX_SIMILAR) return;
      const categories = a.reviewedCategories ?? (a.categoriesReviewedAt ? a.categories ?? [] : []);
      if (!categories.some((c) => storeMeta.categories.includes(c))) continue;
      const slug = slugifyAdvertiserName(a.name);
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      picked.push(a);
    }
  };

  add(manualAdvertisers);
  add(relatedAdvertisers);

  const relatedStores: RelatedStoreItem[] = picked.map((a) => ({
    slug: slugifyAdvertiserName(a.name),
    name: a.name,
    logoUrl: a.logoUrl,
  }));

  const seoContent = generateStoreSeoContent(advertiser.name, allDeals, locale);

  return {
    slug: finalSlug,
    name: advertiser.name,
    network: advertiser.network ?? "awin",
    advertiserId: String(advertiser.id),
    logoUrl: advertiser.logoUrl,
    bannerUrl: storeMeta.bannerUrl,
    rating: finalRating,
    totalReviews: reviews.length,
    activeCouponsCount: coupons.length,
    // The /deals tab renders both no-code `deals` and `promotions` (see that
    // page), so the count/badge must match — promotions alone under-reports it.
    activeDealsCount: deals.length + promotions.length,
    avgSavings: storeMeta.avgSavings,
    description: storeMeta.description,
    websiteUrl,
    officialUrl: safeOfficialUrl(advertiser.officialUrl),
    policyUrls: Object.fromEntries(Object.entries(advertiser.policyUrls ?? {}).flatMap(([key, value]) => { const url = safeOfficialUrl(value); return url ? [[key, url]] : []; })),
    categories: storeMeta.categories,
    coupons,
    deals,
    promotions,
    products,
    // Sourceless sections — filled in later phases (see STORE_PAGES_PLAN.md).
    priceComparisons: [],
    faqs,
    buyingGuides,
    reviews,
    relatedStores,
    latestDiscounts: [],
    // AI store-page content is loaded separately (streamed) via loadStoreAiContent.
    aiStorePage: null,
    seoTitle: seoContent.seoTitle,
    seoDescription: seoContent.seoDescription,
    maxDiscount: seoContent.maxDiscount,
    reviewedBy: (advertiser as any).reviewedBy ?? null,
    reviewedAt: (advertiser as any).reviewedAt ?? null,
    syncedAt: (advertiser as any).syncedAt ?? null,
  };
}

/**
 * Load a store's public data, deduplicated per server request via React.cache.
 * The store page renders `generateMetadata` and the page body in the same
 * request, both needing the store — this ensures the DB work runs once, not
 * twice. `cache` keys on the arguments, so distinct (slug, country) pairs are
 * fetched independently.
 */
export const loadStoreData = cache(loadStoreDataUncached);

/**
 * Load (and, on first visit, generate) the AI store-page content for a merchant.
 * Kept separate from {@link loadStoreData} so the page can render immediately and
 * stream this in behind a Suspense boundary. Cached in the DB after the first
 * generation, so later visits return instantly without re-spending tokens.
 */
export const loadStoreAiContent = cache(async (slug: string, country?: string): Promise<StorePageContent | null> => {
  const advertiser = await getAdvertiserBySlug(slug, country);
  if (!advertiser?.contentReviewedAt) return null;
  const locale = localeForCountry(country || "US");
  return advertiser.aiStorePageByLang?.[locale] ?? (locale === "en" ? advertiser.aiStorePage ?? null : null);
});

function safeOfficialUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || /(?:awin1|admitad|anrdoezrs|commissionfactory|go\.linkwi)/i.test(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}
