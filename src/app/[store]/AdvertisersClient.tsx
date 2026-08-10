"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advertiser } from "@/lib/awin";
import { countryFlag, countryName } from "@/lib/countries";
import AdvertiserCard from "@/components/AdvertiserCard";
import Pagination from "@/components/Pagination";
import SkeletonGrid from "@/components/SkeletonGrid";

const PAGE_SIZE = 24;

interface PageData {
  advertisers: Advertiser[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

interface AdvertisersClientProps {
  country: string;
}

export default function AdvertisersClient({ country }: AdvertisersClientProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (currentSearch: string, currentPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          country,
          relationship: "joined",
        });
        if (currentSearch) params.set("search", currentSearch);

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
      load(search, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, load]);

  function goToPage(next: number) {
    setPage(next);
    load(search, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Advertisers
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <span aria-hidden>{countryFlag(country)}</span>
            Merchants and stores available in {countryName(country)}.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-800">
              Couldn&apos;t load advertisers
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={() => load(search, page)}
              className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search advertisers by name…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 shadow-card outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            {loading ? (
              <SkeletonGrid />
            ) : !data || data.total === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No advertisers match your search
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Try a different search term.
                </p>
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="mt-4 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
