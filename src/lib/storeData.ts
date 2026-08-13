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

import {
  getAdvertiserBySlug,
  slugifyAdvertiserName,
} from "@/lib/db/advertisers";
import { getDealsFromDb } from "@/lib/db/deals";

import { getProductsFromDb } from "@/lib/db/products";
import { getReviewsFromDb } from "@/lib/db/reviews";
import { getFAQsFromDb } from "@/lib/db/faqs";
import { getGuidesFromDb } from "@/lib/db/buyingGuides";
import type { Advertiser } from "@/lib/awin";
import type { Deal } from "@/lib/deals";
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
  isExclusive?: boolean;
  cashbackRate?: string;
  studentVerificationReq?: string;
  affiliateUrl?: string;
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
  badge?: string;
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
  logoUrl: string | null;
  bannerUrl: string | null;
  rating: number;
  totalReviews: number;
  activeCouponsCount: number;
  activeDealsCount: number;
  avgSavings: string | null;
  description: string;
  websiteUrl: string;
  categories: string[];
  coupons: CouponItem[];
  deals: DealItem[];
  products: ProductFeedItem[];
  priceComparisons: PriceComparisonItem[];
  faqs: FAQItem[];
  buyingGuides: BuyingGuideItem[];
  reviews: StoreReviewItem[];
  latestDiscounts: {
    id: string;
    title: string;
    discount: string;
    updatedTime: string;
    type: string;
  }[];
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

/** Seconds remaining until an ISO end date, or undefined if past/absent. */
function secondsUntil(endDate: string | null | undefined): number | undefined {
  if (!endDate) return undefined;
  const ms = new Date(endDate).getTime() - Date.now();
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : undefined;
}

function couponFromDeal(deal: Deal, fallbackUrl: string): CouponItem {
  return {
    id: String(deal.id),
    title: deal.title,
    code: deal.code,
    discount: deal.discountText || "",
    type: deal.subtype || "code",
    description: deal.description || "",
    verified: deal.status === "active",
    expiryDate: deal.endDate,
    isExclusive: deal.isExclusive,
    cashbackRate: deal.cashbackRate || undefined,
    studentVerificationReq: deal.studentVerificationReq || undefined,
    affiliateUrl: deal.trackingUrl || fallbackUrl,
  };
}

function dealFromDeal(
  deal: Deal,
  fallbackUrl: string,
  sourceCurrency: string | null | undefined,
  region: RegionConfig,
  rates: UsdRates,
): DealItem {
  const placement = deal.placement || "todays";

  let badge: string | undefined;
  if (deal.isExclusive) badge = "Exclusive";
  else if (deal.stockPercentage != null) badge = `${deal.stockPercentage}% Claimed`;

  return {
    id: String(deal.id),
    title: deal.title,
    description: deal.description || "",
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
    expiryDate: deal.endDate,
    badge,
    stockPercentage: deal.stockPercentage ?? undefined,
    endsInSeconds: placement === "lightning" ? secondsUntil(deal.endDate) : undefined,
    affiliateUrl: deal.trackingUrl || fallbackUrl,
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load a store's public data from MongoDB. Returns `null` when the slug does
 * not resolve to a known advertiser (caller should render `notFound()`).
 */
export async function loadStoreData(
  slug: string,
  country?: string,
): Promise<StoreData | null> {
  let advertiser: Advertiser | null = null;
  try {
    advertiser = await getAdvertiserBySlug(slug);
  } catch (error) {
    // If MongoDB connection fails, log it and return null (which renders a 404)
    console.warn("MongoDB error in getAdvertiserBySlug:", error);
  }

  if (!advertiser) return null;

  // Region context: prices are converted from the advertiser's native currency
  // into the URL region's currency (e.g. /de -> EUR) and formatted for its locale.
  const region = getRegionConfig(country);
  const rates = await getUsdRates();

  const canonicalSlug = slugifyAdvertiserName(advertiser.name);
  const websiteUrl = advertiser.url || "#";

  const storeMeta = {
    slug: canonicalSlug,
    rating: advertiser.rating || 0,
    bannerUrl: advertiser.bannerUrl || null,
    avgSavings: advertiser.avgSavings || null,
    description: advertiser.description || "",
    categories: advertiser.categories || [],
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

  // Pull every deal for this advertiser (bounded per store).
  const dealsResult = await safeQuery(
    () => getDealsFromDb({ advertiserId: advertiser!.id, status: "all", type: "all", page: 1, pageSize: 100 }),
    { deals: [], page: 1, pageSize: 100, total: 0, totalPages: 1 } as any
  );
  const allDeals: Deal[] = dealsResult?.deals ?? [];

  const coupons = allDeals
    .filter((d) => d.type === "voucher")
    .map((d) => couponFromDeal(d, websiteUrl));

  const deals = allDeals
    .filter((d) => d.type === "promotion")
    .map((d) => dealFromDeal(d, websiteUrl, advertiser.currencyCode, region, rates));

  const productsResult = await safeQuery(
    () => getProductsFromDb({ advertiserId: advertiser!.id, page: 1, pageSize: 50 }),
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
    category: g.category,
    author: g.author,
    date: g.date,
  }));

  return {
    slug: finalSlug,
    name: advertiser.name,
    logoUrl: advertiser.logoUrl,
    bannerUrl: storeMeta.bannerUrl,
    rating: finalRating,
    totalReviews: reviews.length,
    activeCouponsCount: coupons.length,
    activeDealsCount: deals.length,
    avgSavings: storeMeta.avgSavings,
    description: storeMeta.description,
    websiteUrl,
    categories: storeMeta.categories,
    coupons,
    deals,
    products,
    // Sourceless sections — filled in later phases (see STORE_PAGES_PLAN.md).
    priceComparisons: [],
    faqs,
    buyingGuides,
    reviews,
    latestDiscounts: [],
  };
}
