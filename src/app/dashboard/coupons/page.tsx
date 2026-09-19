"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Deal, PagedDeals } from "@/lib/deals";
import DealCard from "@/components/DealCard";
import DealCardSkeleton from "@/components/DealCardSkeleton";
import Pagination from "@/components/Pagination";
import DealModal from "@/components/admin/DealModal";
import DiscoveredDealsModal from "@/components/admin/DiscoveredDealsModal";
import ResearchDealsModal from "@/components/admin/ResearchDealsModal";

const PAGE_SIZE = 24;

/**
 * Coupons management — the same store-offer tooling as the Deals page, locked to
 * voucher/coupon-type offers so the two sidebar sections stay focused.
 */
export default function AdminCouponsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PagedDeals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [isDiscoveredOpen, setIsDiscoveredOpen] = useState(false);
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [pendingDiscoveredCount, setPendingDiscoveredCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/deals/discovered?countOnly=true");
      const json = await res.json();
      if (typeof json.count === "number") {
        setPendingDiscoveredCount(json.count);
      }
    } catch (err) {
      console.warn("Failed to fetch pending discovered count:", err);
    }
  }, []);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  const load = useCallback(
    async (currentSearch: string, currentStatus: string, currentPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          type: "voucher",
          status: currentStatus,
        });
        if (currentSearch) params.set("search", currentSearch);

        const res = await fetch(`/api/deals?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load coupons.");
        setData(json as PagedDeals);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(search, status, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, status, load]);

  function goToPage(next: number) {
    setPage(next);
    load(search, status, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleCreate() {
    setSelectedDeal(null);
    setIsModalOpen(true);
  }

  function handleEdit(deal: Deal) {
    setSelectedDeal(deal);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number, title: string, network?: string) {
    if (!confirm(`Are you sure you want to delete coupon "${title}" (#${id}) from MongoDB?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/admin/deals?id=${id}${network ? `&network=${encodeURIComponent(network)}` : ""}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to delete coupon.");
      load(search, status, page);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting coupon.");
    } finally {
      setDeletingId(null);
    }
  }

  const hasActiveFilters = Boolean(search || status !== "all");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Coupons Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage voucher &amp; promo-code offers stored in MongoDB.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsResearchOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100"
            title="Search RetailMeNot, CouponCabin & live web for deals"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Research Deals (AI / n8n)
          </button>

          <button
            onClick={() => setIsDiscoveredOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${
              pendingDiscoveredCount > 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Discovered Codes</span>
            {pendingDiscoveredCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {pendingDiscoveredCount}
              </span>
            )}
          </button>

          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Coupon
          </button>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, advertiser, code..."
              className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <svg className="absolute left-3 top-2.5 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

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

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">Couldn&apos;t load coupons</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => load(search, status, page)}
            className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DealCardSkeleton key={i} />
              ))}
            </div>
          ) : !data || data.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-700">No coupons match your filters</p>
              <p className="mt-1 text-sm text-gray-500">Try clearing search terms or status filters.</p>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setSearch("");
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
                {data.deals.map((d) => (
                  <div key={d.id} className="relative group">
                    <DealCard deal={d} />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-white/95 p-1 shadow-md border border-gray-200 backdrop-blur-sm transition opacity-90 group-hover:opacity-100">
                      <button
                        onClick={() => handleEdit(d)}
                        title="Edit Coupon"
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-accent transition"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.title, d.network)}
                        disabled={deletingId === d.id}
                        title="Delete Coupon"
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

      <DealModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => load(search, status, page)}
        deal={selectedDeal}
      />

      <DiscoveredDealsModal
        isOpen={isDiscoveredOpen}
        onClose={() => {
          setIsDiscoveredOpen(false);
          loadPendingCount();
        }}
        onDealApproved={() => {
          load(search, status, page);
          loadPendingCount();
        }}
      />

      <ResearchDealsModal
        isOpen={isResearchOpen}
        onClose={() => setIsResearchOpen(false)}
        onSuccess={() => {
          loadPendingCount();
          setIsDiscoveredOpen(true);
        }}
      />
    </main>
  );
}
