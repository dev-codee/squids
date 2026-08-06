"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import { countryFlag, countryName } from "@/lib/countries";
import DealCard from "@/components/DealCard";
import DealCardSkeleton from "@/components/DealCardSkeleton";
import DealsFilterBar, { type DealsFilters } from "@/components/DealsFilterBar";
import Pagination from "@/components/Pagination";
import PublicNav from "@/components/PublicNav";

const PAGE_SIZE = 24;
const EMPTY_FILTERS: DealsFilters = { search: "", type: "all", status: "active" };

interface PageData {
  deals: Deal[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

interface DealsClientProps {
  /** 2-letter ISO country code (uppercase) taken from the URL, e.g. "PK". */
  country: string;
}

export default function DealsClient({ country }: DealsClientProps) {
  const [filters, setFilters] = useState<DealsFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (currentFilters: DealsFilters, currentPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          country,
          status: currentFilters.status,
          type: currentFilters.type,
        });
        if (currentFilters.search) params.set("search", currentFilters.search);

        const res = await fetch(`/api/deals?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load deals.");
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

  // Debounce filter changes and reset to page 1.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(filters, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, load]);

  function goToPage(next: number) {
    setPage(next);
    load(filters, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const hasActiveFilters = Boolean(
    filters.search || filters.type !== "all" || filters.status !== "active",
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNav country={country} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Deals &amp; Vouchers
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <span aria-hidden>{countryFlag(country)}</span>
            Active deals and voucher codes in {countryName(country)}.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-800">
              Couldn&apos;t load deals
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={() => load(filters, page)}
              className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <DealsFilterBar filters={filters} onChange={setFilters} />

            {loading ? (
              <DealCardSkeleton />
            ) : !data || data.total === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <p className="text-sm font-medium text-gray-700">
                  No deals available right now
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Try clearing the filters or checking back later.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="mt-4 text-sm font-medium text-accent hover:text-accent-hover"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.deals.map((d) => (
                    <DealCard key={d.id} deal={d} />
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
