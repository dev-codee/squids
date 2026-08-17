"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Advertiser } from "@/lib/awin";
import type { Deal, PagedDeals } from "@/lib/deals";
import DealCard from "@/components/DealCard";
import DealCardSkeleton from "@/components/DealCardSkeleton";
import Pagination from "@/components/Pagination";
import AdvertiserModal from "@/components/admin/AdvertiserModal";
import DealModal from "@/components/admin/DealModal";

const PAGE_SIZE = 24;

interface PageProps {
  params: { id: string };
}

export default function AdminAdvertiserDealsPage({ params }: PageProps) {
  const advertiserId = Number(params.id);

  // Advertiser state
  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null);
  const [advertiserLoading, setAdvertiserLoading] = useState(true);
  const [advertiserError, setAdvertiserError] = useState<string | null>(null);

  // Deals state
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [dealsData, setDealsData] = useState<PagedDeals | null>(null);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);

  // Modals state
  const [isAdvModalOpen, setIsAdvModalOpen] = useState(false);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<number | null>(null);

  // Fetch advertiser details
  const fetchAdvertiser = useCallback(async () => {
    setAdvertiserLoading(true);
    setAdvertiserError(null);
    try {
      const res = await fetch(`/api/advertisers?id=${advertiserId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to load advertiser.");
      }
      setAdvertiser(json.advertiser);
    } catch (err) {
      setAdvertiserError(err instanceof Error ? err.message : "Error loading advertiser.");
    } finally {
      setAdvertiserLoading(false);
    }
  }, [advertiserId]);

  useEffect(() => {
    fetchAdvertiser();
  }, [fetchAdvertiser]);

  // Fetch deals for this advertiser
  const loadDeals = useCallback(
    async (
      currentSearch: string,
      currentType: string,
      currentStatus: string,
      currentPage: number,
    ) => {
      setDealsLoading(true);
      setDealsError(null);
      try {
        const queryParams = new URLSearchParams({
          advertiserId: String(advertiserId),
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          type: currentType,
          status: currentStatus,
        });
        if (currentSearch) queryParams.set("search", currentSearch);

        const res = await fetch(`/api/deals?${queryParams.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load deals.");
        }
        setDealsData(json as PagedDeals);
      } catch (err) {
        setDealsError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setDealsLoading(false);
      }
    },
    [advertiserId],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadDeals(search, type, status, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, type, status, loadDeals]);

  function goToPage(next: number) {
    setPage(next);
    loadDeals(search, type, status, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleAddDeal() {
    setSelectedDeal(null);
    setIsDealModalOpen(true);
  }

  function handleEditDeal(deal: Deal) {
    setSelectedDeal(deal);
    setIsDealModalOpen(true);
  }

  async function handleDeleteDeal(id: number, title: string, network?: string) {
    if (!confirm(`Are you sure you want to delete deal "${title}" (#${id}) from MongoDB?`)) {
      return;
    }

    setDeletingDealId(id);
    try {
      const res = await fetch(
        `/api/admin/deals?id=${id}${network ? `&network=${encodeURIComponent(network)}` : ""}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete deal.");
      }
      loadDeals(search, type, status, page);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting deal.");
    } finally {
      setDeletingDealId(null);
    }
  }

  const hasActiveFilters = Boolean(search || type !== "all" || status !== "all");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back Link */}
      <div className="mb-4">
        <Link
          href="/dashboard/advertisers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Advertisers
        </Link>
      </div>

      {/* Advertiser Header Info Card */}
      {advertiserLoading ? (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 skeleton h-32" />
      ) : advertiserError || !advertiser ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-800 text-sm">
          {advertiserError || "Advertiser not found."}
        </div>
      ) : (
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                {advertiser.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={advertiser.logoUrl}
                    alt={`${advertiser.name} logo`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-400">
                    {advertiser.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{advertiser.name}</h1>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600">
                    #{advertiser.id}
                  </span>
                  {advertiser.relationship && (
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 capitalize ring-1 ring-inset ring-green-600/20">
                      {advertiser.relationship}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  {advertiser.region && <span>Region: {advertiser.region}</span>}
                  {advertiser.commission && <span>Commission: {advertiser.commission}</span>}
                  {advertiser.currencyCode && <span>Currency: {advertiser.currencyCode}</span>}
                  {advertiser.url && (
                    <a
                      href={advertiser.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:underline"
                    >
                      Visit Store ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAdvModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Advertiser
            </button>
          </div>
        </div>
      )}

      {/* Deals & Promotions Section Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Deals & Promotions
          </h2>
          <p className="text-xs text-gray-500">
            {dealsData ? `${dealsData.total} total deals stored for this merchant` : "Loading deals..."}
          </p>
        </div>

        <button
          onClick={handleAddDeal}
          disabled={!advertiser}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Deal for {advertiser?.name || "Merchant"}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, code, description..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <svg
              className="absolute left-3 top-2.5 text-gray-400"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Deal Types</option>
              <option value="voucher">Vouchers / Coupons Only</option>
              <option value="promotion">Promotions Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expiringSoon">Expiring Soon</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deals Grid / List */}
      {dealsError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">
            Couldn&apos;t load deals
          </p>
          <p className="mt-1 text-sm text-red-600">{dealsError}</p>
          <button
            onClick={() => loadDeals(search, type, status, page)}
            className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {dealsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : !dealsData || dealsData.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-700">
                No deals or promotions found for this merchant
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {hasActiveFilters
                  ? "Try clearing search terms or status filters."
                  : "You can add custom deals for this merchant using the button above."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearch("");
                    setType("all");
                    setStatus("all");
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
                {dealsData.deals.map((d) => (
                  <div key={d.id} className="relative group">
                    <DealCard deal={d} />

                    {/* Admin Action Overlay */}
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-white/95 p-1 shadow-md border border-gray-200 backdrop-blur-sm transition opacity-90 group-hover:opacity-100">
                      <button
                        onClick={() => handleEditDeal(d)}
                        title="Edit Deal"
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-accent transition"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteDeal(d.id, d.title, d.network)}
                        disabled={deletingDealId === d.id}
                        title="Delete Deal"
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
                page={dealsData.page}
                totalPages={dealsData.totalPages}
                total={dealsData.total}
                pageSize={dealsData.pageSize}
                onPageChange={goToPage}
              />
            </>
          )}
        </div>
      )}

      {/* Advertiser Modal */}
      <AdvertiserModal
        isOpen={isAdvModalOpen}
        onClose={() => setIsAdvModalOpen(false)}
        onSaved={fetchAdvertiser}
        advertiser={advertiser}
      />

      {/* Deal Modal */}
      <DealModal
        isOpen={isDealModalOpen}
        onClose={() => setIsDealModalOpen(false)}
        onSaved={() => loadDeals(search, type, status, page)}
        deal={
          selectedDeal ??
          (advertiser
            ? ({
                id: 0,
                network: advertiser.network,
                title: "",
                description: null,
                advertiser: {
                  id: advertiser.id,
                  name: advertiser.name,
                  logoUrl: advertiser.logoUrl,
                },
                type: "voucher",
                code: null,
                startDate: null,
                endDate: null,
                status: "active",
                trackingUrl: advertiser.url,
                regionCodes: advertiser.countryCode ? [advertiser.countryCode] : [],
              } as Deal)
            : null)
        }
      />
    </main>
  );
}
