"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advertiser } from "@/lib/awin";
import { countryFlag, countryName } from "@/lib/countries";
import AdvertiserCard from "@/components/AdvertiserCard";
import Image from "next/image";
import Pagination from "@/components/Pagination";
import SkeletonGrid from "@/components/SkeletonGrid";
import type { HomeSettings } from "@/lib/db/homeSettings";
import HomeReviews from "@/components/home/HomeReviews";
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
  homeSettings: HomeSettings;
}

export default function AdvertisersClient({ country, initialSearch = "", homeSettings }: AdvertisersClientProps) {
  const dict = useDictionary();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<{ id?: string; name: string; slug: string; icon?: string }[]>([]);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync search state if URL search query changes from Header
  useEffect(() => {
    const urlSearch = searchParams.get("search") || "";
    setSearch(urlSearch);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, []);

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

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-800">
              Couldn&apos;t load advertisers
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={() => load(search, selectedCategory, page)}
              className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <SkeletonGrid />
            ) : !data || data.total === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No advertisers match your search or filter
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Try clearing your search term or selecting &quot;All Categories&quot;.
                </p>
                {(search || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory("");
                    }}
                    className="mt-4 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    Clear search and category filter
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

            {/* Categories Section */}
            {categories.length > 0 && (
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Browse by category
                  </h2>
                  {selectedCategory && (
                    <button
                      onClick={() => setSelectedCategory("")}
                      className="text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => setSelectedCategory("")}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium transition ${
                      selectedCategory === ""
                        ? "bg-accent text-white shadow-sm"
                        : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    All Stores
                  </button>
                  {categories.map((c) => {
                    const isSelected = selectedCategory === c.name;
                    return (
                      <button
                        key={c.slug}
                        onClick={() => setSelectedCategory(isSelected ? "" : c.name)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition ${
                          isSelected
                            ? "bg-accent text-white shadow-sm"
                            : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* New Home Page Sections */}
      <HomeReviews reviews={homeSettings.reviews} />
      <HomePopularShops shops={homeSettings.popularShops} />
      <HomeCategories categories={homeSettings.categories} />
      <HomeFaqs faqs={homeSettings.faqs} />
    </div>
  );
}
