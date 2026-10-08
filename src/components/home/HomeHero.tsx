"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDictionary } from "@/i18n/DictionaryProvider";

/** Which search mode the hero tabs are on. */
export type HeroTab = "products" | "stores";

/**
 * Homepage hero: headline, a Products/Stores search switch and the trust strip.
 *
 * Both tabs submit to the country home page — `?tab=products&search=` filters
 * the "Compare before you buy" row server-side, while the stores tab drives the
 * existing advertiser grid through `?search=`.
 */
export default function HomeHero({
  country,
  initialTab = "stores",
  initialSearch = "",
  showProductsTab,
}: {
  country: string;
  initialTab?: HeroTab;
  initialSearch?: string;
  /** Hidden when the region has no products to compare. */
  showProductsTab: boolean;
}) {
  const dict = useDictionary();
  const t = dict.homeV2;
  const router = useRouter();
  const lc = country.toLowerCase();

  const [tab, setTab] = useState<HeroTab>(
    showProductsTab ? initialTab : "stores",
  );
  const [query, setQuery] = useState(initialSearch);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    const qs = params.toString();
    const target = tab === "products" ? `/${lc}/products` : `/${lc}`;
    router.push(qs ? `${target}?${qs}` : target);
  };

  const trust = [
    { label: t.trustMatches, icon: <SearchIcon /> },
    { label: t.trustConditions, icon: <DocIcon /> },
    { label: t.trustTimestamps, icon: <ClockIcon /> },
  ];

  return (
    <section className="bg-canvas pt-6 sm:pt-8">
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="grid items-stretch lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* Copy + search */}
            <div className="px-6 py-10 sm:px-10 sm:py-14">
              <h1 className="text-[28px] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-4xl lg:text-[44px]">
                {t.heroTitleA}
                <br />
                {t.heroTitleB}
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft sm:text-base">
                {t.heroSubtitle}
              </p>

              {/* Tabs */}
              {showProductsTab && (
                <div
                  role="tablist"
                  aria-label={t.searchAction}
                  className="mt-7 inline-flex rounded-card border border-line bg-canvas-sunk p-1"
                >
                  {(["products", "stores"] as HeroTab[]).map((key) => {
                    const active = tab === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setTab(key)}
                        className={`rounded-[9px] px-6 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-white text-ink shadow-card"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        {key === "products" ? t.tabProducts : t.tabStores}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search */}
              <form
                onSubmit={submit}
                className="mt-4 flex items-center gap-2 rounded-card border border-line bg-white p-1.5 shadow-card sm:max-w-lg"
              >
                <span className="pl-2.5 text-ink-muted" aria-hidden>
                  <SearchIcon />
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "products" ? t.searchProducts : t.searchStores
                  }
                  aria-label={
                    tab === "products" ? t.searchProducts : t.searchStores
                  }
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
                <button
                  type="submit"
                  className="flex-shrink-0 rounded-[9px] bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
                >
                  {t.searchAction}
                </button>
              </form>
            </div>

            {/* Lifestyle image */}
            <div className="relative hidden min-h-[260px] bg-canvas-sunk lg:block">
              <Image
                src="/hero-foxzil.png"
                alt=""
                fill
                sizes="(min-width: 1024px) 38vw, 0px"
                className="object-cover object-center"
                priority
              />
            </div>
          </div>

          {/* Trust strip */}
          <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
            {trust.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-center gap-2.5 bg-white px-4 py-4 text-sm font-medium text-ink-soft"
              >
                <span className="text-brand" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
