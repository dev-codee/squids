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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

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
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="List View"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                viewMode === "grid"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
              title="Grid View"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Grid
            </button>
          </div>

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
              {viewMode === "list" ? (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="py-3 pl-4 pr-3">Store &amp; Coupon Title</th>
                          <th className="px-3 py-3">Code</th>
                          <th className="px-3 py-3">Discount</th>
                          <th className="px-3 py-3">Expiry Date</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.deals.map((d) => {
                          const isExpiring = d.endDate && new Date(d.endDate).getTime() < Date.now();

                          return (
                            <tr key={d.id} className="hover:bg-gray-50/70 transition">
                              <td className="py-3 pl-4 pr-3 max-w-md">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                                    🏬 {d.advertiser?.name || "Merchant"}
                                  </span>
                                  {d.isManual && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/50">
                                      Manual
                                    </span>
                                  )}
                                </div>
                                <div className="font-semibold text-gray-900 leading-snug">
                                  {d.title}
                                </div>
                                {d.description && (
                                  <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                                    {d.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {d.code ? (
                                  <div className="inline-flex items-center gap-1.5 rounded border border-dashed border-purple-300 bg-purple-50/60 px-2 py-0.5 font-mono text-xs font-bold text-purple-950">
                                    <span>{d.code}</span>
                                    <button
                                      onClick={() => copyCode(d.code!)}
                                      className="text-[10px] text-purple-600 hover:underline font-normal"
                                      title="Copy code"
                                    >
                                      {copiedCode === d.code ? "✓" : "copy"}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-gray-400 italic">None</span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {d.discountText ? (
                                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                    {d.discountText}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {d.endDate ? (
                                  <span
                                    className={`text-[11px] font-medium ${
                                      isExpiring ? "text-red-600 line-through" : "text-gray-700"
                                    }`}
                                  >
                                    {new Date(d.endDate).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">Ongoing</span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    d.status === "active"
                                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {d.status || "active"}
                                </span>
                              </td>
                              <td className="py-3 pl-3 pr-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleEdit(d)}
                                    title="Edit Coupon"
                                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-accent transition"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(d.id, d.title, d.network)}
                                    disabled={deletingId === d.id}
                                    title="Delete Coupon"
                                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
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
              )}

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
