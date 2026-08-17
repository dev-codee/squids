"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Advertiser, AdvertiserFacets } from "@/lib/awin";
import AdvertiserCard from "@/components/AdvertiserCard";
import FilterBar, { type Filters } from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import RegionSelector from "@/components/RegionSelector";
import SkeletonGrid from "@/components/SkeletonGrid";
import AdvertiserModal from "@/components/admin/AdvertiserModal";

const PAGE_SIZE = 24;
const EMPTY_FILTERS: Filters = { search: "", region: "", relationship: "", category: "", network: "" };
const COUNTRY_KEY = "awin_country";

interface PageData {
  advertisers: Advertiser[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  facets: AdvertiserFacets;
}

export default function AdminAdvertisersPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [country, setCountry] = useState<string | null>("");
  const [countryResolved, setCountryResolved] = useState(true);

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [facets, setFacets] = useState<AdvertiserFacets>({
    regions: [],
    relationships: [],
    countries: [],
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
        if (currentFilters.category)
          params.set("category", currentFilters.category);
        if (currentFilters.network)
          params.set("network", currentFilters.network);
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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!countryResolved) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(filters, 1, country ?? "");
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, country, countryResolved, load]);

  function goToPage(next: number) {
    setPage(next);
    load(filters, next, country ?? "");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleCountryChange(code: string) {
    setCountry(code);
    try {
      localStorage.setItem(COUNTRY_KEY, code);
    } catch {}
  }

  function handleCreate() {
    setSelectedAdvertiser(null);
    setIsModalOpen(true);
  }

  function handleEdit(advertiser: Advertiser) {
    setSelectedAdvertiser(advertiser);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number, name: string, network?: string) {
    if (!confirm(`Are you sure you want to delete "${name}" (#${id}) from MongoDB?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/admin/advertisers?id=${id}${network ? `&network=${encodeURIComponent(network)}` : ""}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete advertiser.");
      }
      load(filters, page, country ?? "");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting advertiser.");
    } finally {
      setDeletingId(null);
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
            Advertisers Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage merchants and store profiles directly in MongoDB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Advertiser
          </button>

          <RegionSelector
            value={country ?? ""}
            countries={facets.countries}
            onChange={handleCountryChange}
            detecting={!countryResolved}
          />
        </div>
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
            categories={facets.categories}
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
                  <div key={a.id} className="relative group">
                    <AdvertiserCard advertiser={a} adminHref={`/dashboard/advertisers/${a.id}`} />

                    {/* Internal-only PPC tag (admin dashboard only) */}
                    {a.isPPC && (
                      <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                        🏷️ PPC
                      </span>
                    )}

                    {/* Admin Action Overlay Bar */}
                    <div
                      className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 p-1 shadow-md border border-gray-200 backdrop-blur-sm transition opacity-90 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleEdit(a);
                        }}
                        title="Edit Advertiser"
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-accent transition"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDelete(a.id, a.name, a.network);
                        }}
                        disabled={deletingId === a.id}
                        title="Delete Advertiser"
                        className="rounded p-1 text-gray-600 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
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

      {/* Modal for Create/Edit */}
      <AdvertiserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => load(filters, page, country ?? "")}
        advertiser={selectedAdvertiser}
      />
    </main>
  );
}
