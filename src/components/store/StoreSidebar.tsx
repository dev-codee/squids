"use client";

import React from "react";
import type { StoreData } from "@/lib/storeData";
import ProductFeedCard from "./ProductFeedCard";
import PriceComparisonWidget from "./PriceComparisonWidget";
import FaqAccordion from "./FaqAccordion";
import ReviewsWidget from "./ReviewsWidget";

interface StoreSidebarProps {
  store: StoreData;
}

export default function StoreSidebar({ store }: StoreSidebarProps) {
  return (
    <aside className="w-full space-y-6">
      {/* Logo & Brand */}
      <div className="bg-white border border-gray-200 p-6 flex flex-col items-center justify-center min-h-[140px] rounded">
        {store.logoUrl ? (
          <img
            src={store.logoUrl}
            alt={`${store.name} Logo`}
            className="max-h-20 max-w-[80%] object-contain mb-2"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <span className="text-4xl font-bold text-amber-500 mb-2">
            {store.name.charAt(0).toUpperCase()}
          </span>
        )}
        <h1 className="text-xl font-bold text-gray-800 text-center">{store.name}</h1>
      </div>

      {/* Deals Details */}
      <div className="bg-white border border-gray-200 p-5 rounded">
        <h3 className="font-bold text-gray-900 mb-4">Deals Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-600">Promo Codes</span>
            <span className="font-semibold">{store.activeCouponsCount}</span>
          </div>
          {store.avgSavings && (
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <span className="text-gray-600">Avg Savings</span>
              <span className="font-semibold">{store.avgSavings}</span>
            </div>
          )}
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-600">Last Updated</span>
            <span className="font-semibold">
              {new Date().toLocaleDateString("en-GB")}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-4 leading-tight">
          We use affiliate links and may receive a commission.
        </p>
      </div>

      {/* Discount codes rating */}
      <div className="bg-white border border-gray-200 p-5 rounded">
        <h3 className="font-bold text-gray-900 mb-3">
          Discount codes rating for {store.name}
        </h3>
        <div className="flex items-center gap-1 text-amber-400 text-lg mb-2">
          {"★".repeat(Math.floor(store.rating || 5))}
          {"☆".repeat(5 - Math.floor(store.rating || 5))}
        </div>
        <p className="text-xs text-gray-500">
          Average rating: {store.rating || "5.0"}, based on {store.totalReviews || 120} votes
        </p>
      </div>

      {/* Contact */}
      <div className="bg-white border border-gray-200 p-5 rounded">
        <h3 className="font-bold text-gray-900 mb-3">{store.name} contact:</h3>
        <a
          href={store.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          {store.name}
        </a>
      </div>

      {/* Categories Filter Pills */}
      {store.categories.length > 0 && (
        <div className="bg-white p-5 rounded border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-3">Check out similar categories</h3>
          <div className="flex flex-wrap gap-2">
            {store.categories.map((cat, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Products Feed */}
      <div className="bg-white p-5 rounded border border-gray-200">
        <div className="mb-4">
          <h2 className="font-bold text-gray-900">Products Feed</h2>
        </div>
        {store.products && store.products.length > 0 ? (
          <div className="flex flex-col gap-4">
            {store.products.map((product) => (
              <ProductFeedCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No products available.</p>
        )}
      </div>

      {/* Price Comparison */}
      <div className="bg-white p-5 rounded border border-gray-200">
        <div className="mb-4">
          <h2 className="font-bold text-gray-900">Price Comparison</h2>
        </div>
        {store.priceComparisons && store.priceComparisons.length > 0 ? (
          <div className="overflow-x-auto pb-2">
            <PriceComparisonWidget items={store.priceComparisons} storeName={store.name} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No price comparisons yet.</p>
        )}
      </div>

      {/* Latest Discounts Feed */}
      <div className="bg-amber-50/50 p-5 rounded border border-amber-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <h3 className="font-bold text-gray-900">Live Updates</h3>
        </div>
        {store.latestDiscounts && store.latestDiscounts.length > 0 ? (
          <div className="flex flex-col gap-3">
            {store.latestDiscounts.map((ld) => (
              <div key={ld.id} className="rounded bg-white p-3.5 border border-amber-100 shadow-sm">
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {ld.type}
                </span>
                <h4 className="text-xs font-bold text-gray-900 mt-1.5 line-clamp-1">{ld.title}</h4>
                <p className="text-xs font-semibold text-emerald-600 mt-0.5">{ld.discount}</p>
                <p className="text-[10px] text-gray-400 mt-1">{ld.updatedTime}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No live updates at the moment.</p>
        )}
      </div>

      {/* Buying Guides */}
      <div className="bg-white p-5 rounded border border-gray-200">
        <div className="mb-4">
          <h2 className="font-bold text-gray-900">Buying Guides</h2>
        </div>
        {store.buyingGuides && store.buyingGuides.length > 0 ? (
          <div className="flex flex-col gap-4">
            {store.buyingGuides.map((guide) => (
              <div key={guide.id} className="flex flex-col justify-between rounded border border-gray-200 bg-white p-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">{guide.title}</h3>
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">{guide.summary}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No buying guides available.</p>
        )}
      </div>

      {/* FAQs */}
      <div className="bg-white p-5 rounded border border-gray-200">
        <div className="mb-4">
          <h2 className="font-bold text-gray-900">FAQs</h2>
        </div>
        {store.faqs && store.faqs.length > 0 ? (
          <FaqAccordion faqs={store.faqs} storeName={store.name} />
        ) : (
          <p className="text-sm text-gray-500">No FAQs available.</p>
        )}
      </div>

      {/* Reviews */}
      <div className="bg-white p-5 rounded border border-gray-200 overflow-hidden">
        {store.reviews && store.reviews.length > 0 ? (
          <ReviewsWidget
            reviews={store.reviews}
            rating={store.rating}
            totalReviews={store.totalReviews}
            storeName={store.name}
          />
        ) : (
          <div>
            <h2 className="font-bold text-gray-900 mb-2">Reviews</h2>
            <p className="text-sm text-gray-500">No reviews yet.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
