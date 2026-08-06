"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advertiser, AdvertiserFacets } from "@/lib/awin";
import AdvertiserCard from "@/components/AdvertiserCard";
import FilterBar, { type Filters } from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import RegionSelector from "@/components/RegionSelector";
import SkeletonGrid from "@/components/SkeletonGrid";

const PAGE_SIZE = 24;
const EMPTY_FILTERS: Filters = { search: "", region: "", relationship: "" };
// localStorage key for a manually chosen region override.
const COUNTRY_KEY = "awin_country";

interface PageData {
  advertisers: Advertiser[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  facets: AdvertiserFacets;
}

/**
 * Admin advertisers view.
 *
 * Unlike the public `/[country]` page, this one (behind auth) keeps the full
 * controls: the region switcher and the status filter. It's how an admin
 * inspects the whole catalogue across regions and relationship states.
 */
export default function AdminAdvertisersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  // country: null while still being detected; "" means "All regions".
  const [country, setCountry] = useState<string | null>(null);
  const [countryResolved, setCountryResolved] = useState(false);

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facets persist across fetches so the dropdowns don't flicker while loading.
  const [facets, setFacets] = useState<AdvertiserFacets>({
    regions: [],
    relationships: [],
    countries: [],
  });

  const load = useCallback(
    async (
      currentFilters: Filters,
      currentPage: number,
      currentCountry: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
        });
        if (currentFilters.search) params.set("search", currentFilters.search);
        if (currentFilters.region) params.set("region", currentFilters.region);
        if (currentFilters.relationship)
          params.set("relationship", currentFilters.relationship);
        if (currentCountry) params.set("country", currentCountry);

        const res = await fetch(`/api/advertisers?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load advertisers.");
        }
        setData(json as PageData);
        if (json.facets) setFacets(json.facets);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Resolve the initial country once: manual override (localStorage) wins,
  // otherwise auto-detect via /api/geo.
  useEffect(() => {
    let cancelled = false;
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(COUNTRY_KEY) : null;

    if (stored !== null) {
      setCountry(stored); // may be "" (user chose All regions)
      setCountryResolved(true);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/geo");
        const geo = await res.json();
        if (!cancelled) setCountry(geo?.country ?? "");
      } catch {
        if (!cancelled) setCountry("");
      } finally {
        if (!cancelled) setCountryResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce filter/country changes and always reset to page 1.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!countryResolved) return; // wait until the country is known
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(filters, 1, country ?? "");
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, country, countryResolved]);

  function goToPage(next: number) {
    setPage(next);
    load(filters, next, country ?? "");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleCountryChange(code: string) {
    setCountry(code);
    // Persist the manual override so it's remembered next visit.
    try {
      localStorage.setItem(COUNTRY_KEY, code);
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
  }

  const hasActiveFilters = Boolean(
    filters.search || filters.region || filters.relationship,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Advertisers
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Merchants and stores your Awin publisher account has joined.
          </p>
        </div>
        <RegionSelector
          value={country ?? ""}
          countries={facets.countries}
          onChange={handleCountryChange}
          detecting={!countryResolved}
        />
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">
            Couldn&apos;t load advertisers
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => load(filters, page, country ?? "")}
            className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            regions={facets.regions}
            relationships={facets.relationships}
          />

          {loading ? (
            <SkeletonGrid />
          ) : !data || data.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-700">
                No advertisers match your filters
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Try clearing the search, filters, or region.
              </p>
              {(hasActiveFilters || country) && (
                <button
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    handleCountryChange("");
                  }}
                  className="mt-4 text-sm font-medium text-accent hover:text-accent-hover"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.advertisers.map((a) => (
                  <AdvertiserCard key={a.id} advertiser={a} />
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
  );
}
