"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StoreData } from "@/lib/storeData";

interface StoreHeaderProps {
  store: StoreData;
}

export default function StoreHeader({ store }: StoreHeaderProps) {
  const pathname = usePathname();
  const currentPath = pathname || `/${store.slug}`;

  const tabs = [
    { label: "Overview & All Offers", href: `/${store.slug}` },
    { label: "Coupons & Codes", href: `/${store.slug}/coupons`, count: store.activeCouponsCount },
    { label: "Deals & Promotions", href: `/${store.slug}/deals`, count: store.activeDealsCount },
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Top Banner & Main Info */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            {/* Store Logo Frame */}
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={`${store.name} Logo`}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-2xl font-bold text-gray-400">
                  {store.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  {store.name} Promo Codes & Coupons
                </h1>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                  Verified Store
                </span>
              </div>

              {/* Rating, reviews & savings — only shown when data exists */}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {store.totalReviews > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex text-amber-400">
                      {"★".repeat(Math.floor(store.rating))}
                      {"☆".repeat(5 - Math.floor(store.rating))}
                    </div>
                    <span className="font-semibold text-gray-900">{store.rating}</span>
                    <span className="text-gray-500">({store.totalReviews.toLocaleString()} reviews)</span>
                  </div>
                )}
                {store.avgSavings && (
                  <>
                    {store.totalReviews > 0 && <span className="text-gray-300">•</span>}
                    <span className="font-medium text-emerald-600">
                      Avg Savings: <span className="font-bold">{store.avgSavings}</span>
                    </span>
                  </>
                )}
                <span className="font-medium text-gray-700">
                  {store.activeCouponsCount} coupons · {store.activeDealsCount} deals
                </span>
              </div>
            </div>
          </div>

          {/* Action Stats / Visit Store Button */}
          <div className="flex items-center gap-3">
            <a
              href={store.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Shop {store.name} Direct
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 flex overflow-x-auto border-b border-gray-200 scrollbar-none">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const isActive = currentPath === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition ${
                    isActive
                      ? "border-amber-500 text-amber-600 font-semibold"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
