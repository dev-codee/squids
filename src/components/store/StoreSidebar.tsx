"use client";

import React from "react";
import type { StoreData } from "@/lib/storeData";
import type { StorePageContent } from "@/lib/ai/storeContent";
import PriceComparisonWidget from "./PriceComparisonWidget";
import ReviewsWidget from "./ReviewsWidget";
import StarRating from "./StarRating";
import { useDictionary } from "@/i18n/DictionaryProvider";

function hasVal(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s !== "" && s !== "not available" && s !== "n/a" && s !== "unknown" && s !== "verification required";
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!hasVal(value)) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-line last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium text-ink text-right">{value}</span>
    </div>
  );
}

/**
 * Rating row for the AI-researched Trustpilot/Google numbers. These are a best-effort
 * lookup (see src/lib/ai/storeContent.ts), not a live API pull — shown with stars for
 * scannability, but always labeled "AI-researched" so it isn't mistaken for a live score.
 */
function RatingSourceRow({ label, rating, reviewCount }: { label: string; rating?: string; reviewCount?: string }) {
  if (!hasVal(rating)) return null;
  const numeric = parseFloat(rating!);
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm border-b border-line last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="flex items-center gap-1.5">
        {Number.isFinite(numeric) && <StarRating value={numeric} size="xs" />}
        <span className="font-medium text-ink">
          {rating}/5{hasVal(reviewCount) ? ` (${reviewCount})` : ""}
        </span>
      </span>
    </div>
  );
}

interface StoreSidebarProps {
  store: StoreData;
  aiContent?: StorePageContent | null;
  /** 2-letter region code from the current URL (for the follow-store form). */
  country?: string;
}

export default function StoreSidebar({ store, aiContent, country }: StoreSidebarProps) {
  const dict = useDictionary();

  const trust = aiContent?.trustpilot;
  const google = aiContent?.google_rating;
  const showTrustPanel =
    aiContent &&
    (hasVal(trust?.rating) ||
      hasVal(google?.rating) ||
      hasVal(aiContent.typical_discount) ||
      hasVal(aiContent.cashback?.rate) ||
      hasVal(aiContent.cashback?.available));

  return (
    <aside className="w-full space-y-6">
      {/* Store About Box */}
      {hasVal(aiContent?.hero_intro) && (
        <div className="bg-white p-5 rounded border border-line">
          <p className="text-sm leading-relaxed text-ink-soft text-justify whitespace-pre-line">
            {aiContent.hero_intro}
          </p>
        </div>
      )}

      {/* Store Trust & Info Box */}
      {showTrustPanel && aiContent && (
        <div className="bg-white p-5 rounded border border-line">
          <h3 className="font-bold text-ink mb-3">{dict.sidebar.storeTrustInfo}</h3>
          <div>
            <RatingSourceRow label="Trustpilot" rating={trust?.rating} reviewCount={trust?.review_count} />
            <RatingSourceRow label="Google" rating={google?.rating} reviewCount={google?.review_count} />
            <InfoRow label={dict.sidebar.typicalDiscount} value={aiContent.typical_discount} />
            <InfoRow label={dict.sidebar.cashbackRate} value={aiContent.cashback?.rate} />
            {!hasVal(aiContent.cashback?.rate) && <InfoRow label={dict.sidebar.cashback} value={aiContent.cashback?.available} />}
          </div>
          {(hasVal(trust?.rating) || hasVal(google?.rating)) && (
            <p className="mt-3 text-[10px] text-ink-muted leading-tight">
              Trustpilot/Google scores are AI-researched from public listings, not a live feed — check the source directly for the current number.
            </p>
          )}
        </div>
      )}

      {/* Deals Details */}
      <div className="bg-white border border-line p-5 rounded">
        <h3 className="font-bold text-ink mb-4">{dict.sidebar.dealsDetails}</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">{dict.sidebar.promoCodes}</span>
            <span className="font-semibold">{store.coupons.length}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">{dict.sidebar.deals}</span>
            <span className="font-semibold">{store.deals.length}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">{dict.sidebar.promotions}</span>
            <span className="font-semibold">{store.promotions.length + store.products.length}</span>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <span className="font-semibold text-ink">{dict.sidebar.totalOffers}</span>
            <span className="font-bold text-ink">
              {store.coupons.length + store.deals.length + store.promotions.length + store.products.length}
            </span>
          </div>
          {store.avgSavings && (
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-soft">{dict.sidebar.avgSavings}</span>
              <span className="font-semibold">{store.avgSavings}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-line pb-2">
            <span className="text-ink-soft">{dict.sidebar.lastUpdated}</span>
            <span className="font-semibold">
              {store.syncedAt ? new Date(store.syncedAt).toLocaleDateString() : dict.storeV2.notAvailable}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-ink-muted mt-4 leading-tight">
          {dict.sidebar.affiliateDisclaimer}
        </p>
      </div>

      {/* Discount codes rating — only shown when real votes exist */}
      {store.totalReviews > 0 && store.rating > 0 && (
        <div className="bg-white border border-line p-5 rounded">
          <h3 className="font-bold text-ink mb-3">
            {dict.sidebar.discountCodesRating.replace("{store}", store.name)}
          </h3>
          <div className="mb-2">
            <StarRating value={store.rating} size="md" />
          </div>
          <p className="text-xs text-ink-soft">
            {dict.sidebar.averageRating
              .replace("{rating}", String(store.rating))
              .replace("{votes}", String(store.totalReviews))}
          </p>
        </div>
      )}

      {/* Contact */}
      {store.policyUrls?.support && <div className="bg-white border border-line p-5 rounded">
        <h3 className="font-bold text-ink mb-3">{dict.sidebar.contact.replace("{store}", store.name)}</h3>
        <a
          href={store.policyUrls?.support}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          {store.name}
        </a>
      </div>}

      {/* Categories Filter Pills */}
      {store.categories.length > 0 && (
        <div className="bg-white p-5 rounded border border-line">
          <h3 className="font-bold text-ink mb-3">{dict.sidebar.similarCategories}</h3>
          <div className="flex flex-wrap gap-2">
            {store.categories.map((cat, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-canvas border border-line rounded-full text-xs text-ink-soft hover:bg-canvas-sunk cursor-pointer"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Price Comparison — only when data exists */}
      {store.priceComparisons && store.priceComparisons.length > 0 && (
        <div className="bg-white p-5 rounded border border-line">
          <div className="mb-4">
            <h2 className="font-bold text-ink">{dict.sidebar.priceComparison}</h2>
          </div>
          <div className="overflow-x-auto pb-2">
            <PriceComparisonWidget items={store.priceComparisons} storeName={store.name} />
          </div>
        </div>
      )}

      {/* Latest Discounts Feed — only when data exists */}
      {store.latestDiscounts && store.latestDiscounts.length > 0 && (
        <div className="bg-brand-soft/50 p-5 rounded border border-brand-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h3 className="font-bold text-ink">{dict.sidebar.liveUpdates}</h3>
          </div>
          <div className="flex flex-col gap-3">
            {store.latestDiscounts.map((ld) => (
              <div key={ld.id} className="rounded bg-white p-3.5 border border-brand-soft shadow-sm">
                <span className="rounded bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-hover">
                  {ld.type}
                </span>
                <h4 className="text-xs font-bold text-ink mt-1.5 line-clamp-1">{ld.title}</h4>
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">{ld.discount}</p>
                <p className="text-[10px] text-ink-muted mt-1">{ld.updatedTime}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buying Guides — only when data exists */}
      {store.buyingGuides && store.buyingGuides.length > 0 && (
        <div className="bg-white p-5 rounded border border-line">
          <div className="mb-4">
            <h2 className="font-bold text-ink">{dict.sidebar.buyingGuides}</h2>
          </div>
          <div className="flex flex-col gap-4">
            {store.buyingGuides.map((guide) => (
              <div key={guide.id} className="flex flex-col justify-between rounded border border-line bg-white p-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-ink leading-snug">{guide.title}</h3>
                  <p className="mt-2 text-xs text-ink-soft leading-relaxed line-clamp-2">{guide.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews — only when data exists */}
      {store.reviews && store.reviews.length > 0 && (
        <div className="bg-white p-5 rounded border border-line overflow-hidden">
          <ReviewsWidget
            reviews={store.reviews}
            rating={store.rating}
            totalReviews={store.totalReviews}
            storeName={store.name}
          />
        </div>
      )}
    </aside>
  );
}
