"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import type { StoreData } from "@/lib/storeData";
import { countryFlag, countryName } from "@/lib/countries";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { getRegionConfig } from "@/lib/regions";
import FollowStoreButton from "./FollowStoreButton";

interface StoreHeaderProps {
  store: StoreData;
  country?: string;
}

/**
 * Store identity header: merchant name, what this page covers, the market it
 * applies to, and the two distinct actions from the brief — "Save store"
 * (alerts) and "Visit store" (the disclosed merchant destination).
 *
 * The route tabs below it stay real navigation: /coupons and /deals are
 * separate indexed pages, so they keep their own tab strip.
 */
export default function StoreHeader({ store, country: countryProp }: StoreHeaderProps) {
  const dict = useDictionary();
  const t = dict.storeV2;
  const pathname = usePathname();
  const params = useParams();
  const country =
    countryProp || (typeof params?.country === "string" ? params.country : "") || "us";
  const cc = country.toUpperCase();
  const base = `/${country}/${store.slug}`;
  const currentPath = pathname || base;

  const tabs = [
    { label: t.allOffers, href: base, count: store.activeCouponsCount + store.activeDealsCount + store.products.length },
    { label: t.tabCoupons, href: `${base}/coupons`, count: store.activeCouponsCount },
    { label: t.tabPromotions, href: `${base}/deals`, count: store.activeDealsCount + store.products.length },
  ];

  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto max-w-shell px-4 pt-6 sm:px-6 lg:px-8">
        {/* Identity card */}
        <div className="rounded-card border border-line bg-store-header p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-card border border-line bg-white p-2.5">
                {store.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={store.logoUrl}
                    alt={`${store.name} logo`}
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-xl font-bold text-ink-muted">
                    {store.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                {/* h2: each route supplies its own h1 below. */}
                <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
                  {store.name}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-ink-soft">
                  {t.offersAndPrices}
                </p>
                <p className="mt-1 text-sm text-ink-soft">{t.checkOffer}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-ink-soft">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1">
                    <span aria-hidden>{countryFlag(cc)}</span>
                    {countryName(cc)}
                  </span>
                  {store.websiteUrl && (
                    <a
                      href={store.websiteUrl}
                      target="_blank"
                      rel="nofollow noopener noreferrer sponsored"
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 transition-colors hover:border-brand-border hover:text-brand"
                    >
                      {t.officialWebsite}
                      <span aria-hidden>↗</span>
                    </a>
                  )}
                  {store.reviewedBy && store.reviewedAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                      ✓ Reviewed by {store.reviewedBy} on {new Date(store.reviewedAt).toLocaleDateString()}
                    </span>
                  ) : store.syncedAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-ink-muted">
                      {dict.sidebar.lastUpdated} {new Date(store.syncedAt).toLocaleDateString(getRegionConfig(cc).locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    </span>
                  ) : null}
                  <Link
                    href={`/${country}/report-issue?type=expired_deal&store=${encodeURIComponent(store.slug)}`}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-ink-muted transition-colors hover:border-brand-border hover:text-brand"
                    title={dict.offerUi.report}
                  >
                    <span>⚑</span> {dict.offerUi.report}
                  </Link>
                </div>
              </div>
            </div>

            {/* Two distinct actions, with the offer-alert sign-up directly below
                them — it belongs with the other store-level actions rather than
                halfway down the sidebar. */}
            <div className="flex w-full flex-shrink-0 flex-col gap-3 md:w-auto md:min-w-[260px]">
              <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
                <FollowStoreButton
                  store={{
                    slug: store.slug,
                    network: store.network,
                    advertiserId: store.advertiserId,
                    name: store.name,
                  }}
                  country={country}
                  compact
                  label={dict.offerUi.followShort}
                />
                <a
                  href={store.websiteUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="inline-flex items-center justify-center gap-1.5 rounded-[9px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
                >
                  {t.visitStore}
                  <span aria-hidden>↗</span>
                </a>
              </div>

              <div className="rounded-card border border-brand-border bg-white/80 p-3.5">
                <h3 className="text-sm font-bold text-ink">{t.saveThisStore}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {t.saveThisStoreDesc.replace("{store}", store.name)}
                </p>
                <div className="mt-2.5">
                  <FollowStoreButton
                    store={{
                      slug: store.slug,
                      network: store.network,
                      advertiserId: store.advertiserId,
                      name: store.name,
                    }}
                    country={country}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* The affiliate disclosure is carried in the page footer rather than as
            a banner above the offers. */}

        {/* Route tabs */}
        <nav className="scrollbar-none mt-4 flex gap-6 overflow-x-auto border-b border-line">
          {tabs.map((tab) => {
            const isActive = currentPath === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm transition ${
                  isActive
                    ? "border-brand font-semibold text-brand"
                    : "border-transparent font-medium text-ink-soft hover:border-line-strong hover:text-ink"
                }`}
              >
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    isActive ? "bg-brand-soft text-brand" : "bg-canvas-sunk text-ink-muted"
                  }`}
                >
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
