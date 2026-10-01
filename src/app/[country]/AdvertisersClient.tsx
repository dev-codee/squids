"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advertiser } from "@/lib/awin";
import { countryName } from "@/lib/countries";
import AdvertiserCard from "@/components/AdvertiserCard";
import Pagination from "@/components/Pagination";
import SkeletonGrid from "@/components/SkeletonGrid";
import type { HomeSettings } from "@/lib/db/homeSettings";
import type { Deal } from "@/lib/deals";
import type { Product } from "@/lib/products";
import type { PopularShopData } from "@/lib/db/deals";
import HomeHero, { type HeroTab } from "@/components/home/HomeHero";
import HomeSection from "@/components/home/HomeSection";
import HomeProducts from "@/components/home/HomeProducts";
import HomeStoreDeals from "@/components/home/HomeStoreDeals";
import HomeValueBand from "@/components/home/HomeValueBand";
import HomeTools from "@/components/home/HomeTools";
import HomePopularShops from "@/components/home/HomePopularShops";
import HomeCategories, { type HomeCategoryTile } from "@/components/home/HomeCategories";
import HomeFaqs from "@/components/home/HomeFaqs";
import { useDictionary } from "@/i18n/DictionaryProvider";

import { useSearchParams } from "next/navigation";

const HOME_PAGE_SIZE = 12;
const STORES_PAGE_SIZE = 35;

interface PageData {
  advertisers: Advertiser[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

interface AdvertisersClientProps {
  country: string;
  initialSearch?: string;
  /** Which hero search tab the URL asked for ("products" via `?tab=products`). */
  initialTab?: HeroTab;
  /** Home marketing sections + hero. Optional for the focused "stores" variant. */
  homeSettings?: HomeSettings;
  /** Newest deals for the homepage "Store deals" shelf. */
  recentDeals?: Deal[];
  /** Products for the "Compare before you buy" row (empty hides the section). */
  products?: Product[];
  /** Auto-populated popular shops (stores with the most deals). */
  popularShops?: PopularShopData[];
  /** Server-resolved category tiles for the "Shop by category" row. */
  categories?: HomeCategoryTile[];
  /** "home" shows the hero + marketing sections; "stores" is a bare browsing grid. */
  variant?: "home" | "stores";
}

export default function AdvertisersClient({
  country,
  initialSearch = "",
  initialTab = "stores",
  homeSettings,
  recentDeals = [],
  products = [],
  popularShops = [],
  categories = [],
  variant = "home",
}: AdvertisersClientProps) {
  const isHome = variant === "home";
  const dict = useDictionary();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState("");
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const [page, setPage] = useState(isNaN(initialPage) || initialPage < 1 ? 1 : initialPage);

  // A product-tab search filters the comparison row server-side; the store grid
  // stays out of the way in that mode.
  const productMode = isHome && initialTab === "products";

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync search state if URL search query changes from Header
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    setSearch(urlSearch);
  }, [searchParams]);

  const load = useCallback(
    async (currentSearch: string, currentCategory: string, currentPage: number) => {
      setLoading(true);
      setError(null);

      const pageSize = isHome ? HOME_PAGE_SIZE : STORES_PAGE_SIZE;
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(pageSize),
        country,
        relationship: "joined",
        requireDeals: "true",
      });
      // Showcase mode: lightweight pre-limited query for home page
      if (isHome) params.set("showcase", "true");
      if (currentSearch) params.set("search", currentSearch);
      if (currentCategory) params.set("category", currentCategory);
      const url = `/api/advertisers?${params.toString()}`;

      // Fetch with a timeout, retrying once on a transient network failure
      // (e.g. a truncated/timed-out response) before surfacing the error wall.
      const fetchOnce = async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const res = await fetch(url, { signal: controller.signal });
          const json = await res.json();
          if (!res.ok) {
            throw new Error(json?.error ?? "Failed to load advertisers.");
          }
          return json as PageData;
        } finally {
          clearTimeout(timeout);
        }
      };

      try {
        let result: PageData;
        try {
          result = await fetchOnce();
        } catch {
          // One automatic retry for transient failures.
          result = await fetchOnce();
        }
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [country, isHome],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    // The home page only shows the store grid once a search is active, so skip
    // the request entirely until then.
    if (isHome && (productMode || (!search.trim() && !selectedCategory))) {
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(search, selectedCategory, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, selectedCategory, load, isHome, productMode]);

  function goToPage(next: number) {
    setPage(next);
    load(search, selectedCategory, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // On the home page the store grid is a search result shelf: it only takes
  // over the page once the shopper has actually searched for a store.
  const searching = Boolean(search.trim()) && !productMode;
  const showStoreGrid = !isHome || searching;

  const storeGrid = (
    <>
      {error ? (
        <div className="rounded-card border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">{dict.stores.couldntLoad}</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => load(search, selectedCategory, page)}
            className="mt-4 inline-flex items-center rounded-[9px] bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-hover"
          >
            {dict.common.tryAgain}
          </button>
        </div>
      ) : loading ? (
        <SkeletonGrid />
      ) : !data || data.total === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-white p-12 text-center">
          <p className="text-sm font-medium text-ink">{dict.stores.noMatchTitle}</p>
          <p className="mt-1 text-sm text-ink-muted">{dict.stores.noMatchHint}</p>
          {(search || selectedCategory) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("");
              }}
              className="mt-4 text-sm font-medium text-brand hover:text-brand-hover"
            >
              {dict.stores.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {data.advertisers.map((a) => (
              <AdvertiserCard key={a.id} advertiser={a} country={country} />
            ))}
          </div>

          {!isHome && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={goToPage}
              buildHref={(p) => {
                const base =
                  variant === "stores"
                    ? `/${country.toLowerCase()}/stores`
                    : `/${country.toLowerCase()}`;
                const ps = new URLSearchParams();
                if (search) ps.set("search", search);
                if (p > 1) ps.set("page", String(p));
                const qs = ps.toString();
                return qs ? `${base}?${qs}` : base;
              }}
            />
          )}
        </div>
      )}
    </>
  );

  // Focused "all stores" browsing page — no hero, no marketing sections.
  if (!isHome) {
    return (
      <div className="min-h-screen bg-canvas">
        <main className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {dict.stores.allStores}
            </h1>
            <p className="mt-2 text-base text-ink-soft">
              {dict.stores.browseSubtitle.replace("{country}", countryName(country))}
            </p>
          </header>
          {storeGrid}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <HomeHero
        country={country}
        initialTab={initialTab}
        initialSearch={initialSearch}
        showProductsTab={products.length > 0 || initialTab === "products"}
      />

      {showStoreGrid && (
        <HomeSection title={dict.stores.allStores} tone="canvas">
          {storeGrid}
        </HomeSection>
      )}

      <HomeProducts products={products} country={country} />
      <HomeCategories
        categories={categories}
        fallback={homeSettings?.categories}
        country={country}
      />
      <HomePopularShops shops={popularShops} country={country} />
      <HomeStoreDeals deals={recentDeals} country={country} />
      <HomeValueBand country={country} />
      <HomeTools country={country} />
      <HomeFaqs faqs={homeSettings?.faqs ?? []} />
    </div>
  );
}
