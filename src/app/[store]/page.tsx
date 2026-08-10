import { notFound, redirect } from "next/navigation";
import { loadStoreData } from "@/lib/storeData";
import AdvertisersClient from "./AdvertisersClient";
import StoreHeader from "@/components/store/StoreHeader";
import CouponCard from "@/components/store/CouponCard";
import LightningDealCard from "@/components/store/LightningDealCard";
import ProductFeedCard from "@/components/store/ProductFeedCard";
import PriceComparisonWidget from "@/components/store/PriceComparisonWidget";
import FaqAccordion from "@/components/store/FaqAccordion";
import ReviewsWidget from "@/components/store/ReviewsWidget";

export const dynamic = "force-dynamic";

// 2-letter country code check
const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

export default async function StoreMainPage({
  params,
}: {
  params: { store: string };
}) {
  const rawSlug = params.store;

  // Handle country route backward compatibility (e.g. /us, /pk)
  if (COUNTRY_CODE_RE.test(rawSlug)) {
    return <AdvertisersClient country={rawSlug.toUpperCase()} />;
  }

  // Canonicalize store slug to lowercase (e.g. /Amazon -> /amazon)
  if (rawSlug !== rawSlug.toLowerCase()) {
    redirect(`/${rawSlug.toLowerCase()}`);
  }

  const store = await loadStoreData(rawSlug);
  if (!store) notFound();

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Store Header & Navigation */}
      <StoreHeader store={store} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">

        {/* Categories Filter Pills */}
        {store.categories.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Browse {store.name} Categories</h2>
              <span className="text-xs text-gray-500">{store.categories.length} categories available</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {store.categories.map((cat, idx) => (
                <button
                  key={idx}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                    idx === 0
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-amber-400 hover:bg-amber-50/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Coupons Section */}
        {store.coupons.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">
                  Top {store.name} Coupons &amp; Promo Codes
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Hand-tested promo codes verified for instant savings.
                </p>
              </div>
              <a
                href={`/${store.slug}/coupons`}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              >
                View All {store.activeCouponsCount} Coupons →
              </a>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {store.coupons.slice(0, 6).map((coupon) => (
                <CouponCard key={coupon.id} coupon={coupon} storeName={store.name} />
              ))}
            </div>
          </section>
        )}

        {/* Deals Section */}
        {store.deals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">
                  Today&apos;s {store.name} Deals &amp; Promotions
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Hot discounts, lightning flash sales, and price drop highlights.
                </p>
              </div>
              <a
                href={`/${store.slug}/deals`}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
              >
                View All Deals →
              </a>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {store.deals.map((deal) => (
                <LightningDealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </section>
        )}

        {/* Products Feed */}
        {store.products.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900">
                  Curated {store.name} Products Feed
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Trending products with active discount pricing.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {store.products.map((product) => (
                <ProductFeedCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {/* Price Comparison */}
        {store.priceComparisons.length > 0 && (
          <section>
            <PriceComparisonWidget items={store.priceComparisons} storeName={store.name} />
          </section>
        )}

        {/* Latest Discounts Feed */}
        {store.latestDiscounts.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h3 className="text-lg font-bold text-gray-900">Live {store.name} Discount Updates</h3>
              </div>
              <span className="text-xs font-medium text-gray-500">Auto-Refreshed</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {store.latestDiscounts.map((ld) => (
                <div key={ld.id} className="rounded-xl bg-white p-3.5 border border-amber-100 shadow-sm">
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {ld.type}
                  </span>
                  <h4 className="text-xs font-bold text-gray-900 mt-1.5 line-clamp-1">{ld.title}</h4>
                  <p className="text-xs font-semibold text-emerald-600 mt-0.5">{ld.discount}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{ld.updatedTime}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Buying Guides */}
        {store.buyingGuides.length > 0 && (
          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-extrabold text-gray-900">
                {store.name} Money-Saving &amp; Buying Guides
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Expert tips and strategies for getting maximum savings at checkout.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {store.buyingGuides.map((guide) => (
                <div key={guide.id} className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span className="rounded-lg bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">{guide.category}</span>
                      <span>{guide.readTime}</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">{guide.title}</h3>
                    <p className="mt-2 text-xs text-gray-600 leading-relaxed">{guide.summary}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>By {guide.author}</span>
                    <span>{guide.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQs */}
        {store.faqs.length > 0 && (
          <section>
            <FaqAccordion faqs={store.faqs} storeName={store.name} />
          </section>
        )}

        {/* Reviews */}
        {store.reviews.length > 0 && (
          <section>
            <ReviewsWidget
              reviews={store.reviews}
              rating={store.rating}
              totalReviews={store.totalReviews}
              storeName={store.name}
            />
          </section>
        )}

        {/* Empty state — advertiser exists but has no published offers yet */}
        {store.coupons.length === 0 && store.deals.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-semibold text-gray-700">
              No offers published for {store.name} yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Coupons and deals will appear here once they&apos;re added.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
