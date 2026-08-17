"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advertiser } from "@/lib/awin";
import { countryFlag, countryName } from "@/lib/countries";
import AdvertiserCard from "@/components/AdvertiserCard";
import Image from "next/image";
import Pagination from "@/components/Pagination";
import SkeletonGrid from "@/components/SkeletonGrid";
import type { HomeSettings } from "@/lib/db/homeSettings";
import type { Deal } from "@/lib/deals";
import type { PopularShopData } from "@/lib/db/deals";
import HomeRecentDeals from "@/components/home/HomeRecentDeals";
import HomePopularShops from "@/components/home/HomePopularShops";
import HomeCategories from "@/components/home/HomeCategories";
import HomeFaqs from "@/components/home/HomeFaqs";
import { useDictionary } from "@/i18n/DictionaryProvider";

import { useSearchParams } from "next/navigation";

const PAGE_SIZE = 35;

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
  /** Home marketing sections + hero. Optional for the focused "stores" variant. */
  homeSettings?: HomeSettings;
  /** Newest deals for the homepage showcase. */
  recentDeals?: Deal[];
  /** Auto-populated popular shops (stores with the most deals). */
  popularShops?: PopularShopData[];
  /** "home" shows the hero + marketing sections; "stores" is a bare browsing grid. */
  variant?: "home" | "stores";
}

export default function AdvertisersClient({
  country,
  initialSearch = "",
  homeSettings,
  recentDeals = [],
  popularShops = [],
  variant = "home",
}: AdvertisersClientProps) {
  const isHome = variant === "home";
  const dict = useDictionary();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [page, setPage] = useState(1);

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
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          country,
          relationship: "joined",
          requireDeals: "true",
        });
        if (currentSearch) params.set("search", currentSearch);
        if (currentCategory) params.set("category", currentCategory);

        const res = await fetch(`/api/advertisers?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load advertisers.");
        }
        setData(json as PageData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [country],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(search, selectedCategory, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, selectedCategory, load]);

  function goToPage(next: number) {
    setPage(next);
    load(search, selectedCategory, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {isHome ? (
          <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="w-full md:w-1/2 flex justify-center">
              <Image
                src="/hero-foxzil.png"
                alt="Foxzil Deals"
                width={500}
                height={300}
                className="max-w-full h-auto max-h-[300px] object-contain"
                priority
              />
            </div>
            <div className="w-full md:w-1/2 text-center md:text-left">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                {dict.home.heroTitle}
              </h1>
              <p className="mt-4 text-base text-gray-500">
                {dict.home.heroSubtitle} {countryName(country)}.
              </p>
            </div>
          </header>
        ) : (
          <header className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              {dict.stores.allStores}
            </h1>
            <p className="mt-2 text-base text-gray-500">
              {dict.stores.browseSubtitle.replace("{country}", countryName(country))}
            </p>
          </header>
        )}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-800">
              {dict.stores.couldntLoad}
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={() => load(search, selectedCategory, page)}
              className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              {dict.common.tryAgain}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <SkeletonGrid />
            ) : !data || data.total === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-gray-700">
                  {dict.stores.noMatchTitle}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {dict.stores.noMatchHint}
                </p>
                {(search || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory("");
                    }}
                    className="mt-4 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    {dict.stores.clearFilters}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {data.advertisers.map((a) => (
                    <AdvertiserCard key={a.id} advertiser={a} country={country} />
                  ))}
                </div>

                <Pagination
                  page={data.page}
                  totalPages={data.totalPages}
                  total={data.total}
                  pageSize={data.pageSize}
                  onPageChange={goToPage}
                />
              </>
            )}
          </div>
        )}
      </main>

      {/* New Home Page Sections */}
      {isHome && homeSettings && (
        <>
          <HomeRecentDeals deals={recentDeals} country={country} />
          <HomePopularShops shops={popularShops} country={country} />
          <HomeCategories categories={homeSettings.categories} />
          <HomeFaqs faqs={homeSettings.faqs} />
        </>
      )}
    </div>
  );
}
