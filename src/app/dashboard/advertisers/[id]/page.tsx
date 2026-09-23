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
import DiscoveredDealsModal from "@/components/admin/DiscoveredDealsModal";
import ResearchDealsModal from "@/components/admin/ResearchDealsModal";
import { resolveAffiliateTrackingUrl } from "@/lib/affiliateUrls";
import { cleanAdvertiserName } from "@/lib/networks";
import { normalizeCountryCode } from "@/lib/countries";

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
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [dealsData, setDealsData] = useState<PagedDeals | null>(null);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);

  // Modals state
  const [isAdvModalOpen, setIsAdvModalOpen] = useState(false);
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<number | null>(null);

  // Store-specific Research & Discovered deals modals
  const [isDiscoveredOpen, setIsDiscoveredOpen] = useState(false);
  const [isResearchOpen, setIsResearchOpen] = useState(false);
  const [pendingDiscoveredCount, setPendingDiscoveredCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/deals/discovered?countOnly=true&advertiserId=${advertiserId}`);
      const json = await res.json();
      if (typeof json.count === "number") {
        setPendingDiscoveredCount(json.count);
      }
    } catch (err) {
      console.warn("Failed to fetch pending discovered count for advertiser:", err);
    }
  }, [advertiserId]);

  useEffect(() => {
    loadPendingCount();
  }, [loadPendingCount]);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

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
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 uppercase ring-1 ring-inset ring-blue-600/20">
                    {advertiser.network || "awin"}
                  </span>
                  {advertiser.relationship && (
                    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 capitalize ring-1 ring-inset ring-green-600/20">
                      {advertiser.relationship}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="font-semibold text-emerald-600">
                    Total Deals: {dealsData?.total ?? advertiser.dealCount ?? 0}
                  </span>
                  {advertiser.region && <span>Region: {advertiser.region}</span>}
                  {advertiser.commission && <span>Commission: {advertiser.commission}</span>}
                  {advertiser.currencyCode && <span>Currency: {advertiser.currencyCode}</span>}
                  {advertiser.url && (
                    <a
                      href={resolveAffiliateTrackingUrl(advertiser.network, advertiser.id, advertiser.url)}
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

            <div className="flex items-center gap-2">
              {(() => {
                const cc = normalizeCountryCode(
                  advertiser.countryCode ||
                  (Array.isArray(advertiser.countryCodes) && advertiser.countryCodes[0]) ||
                  advertiser.region
                );
                const country = cc && cc !== "WW" && cc.length === 2 ? cc.toLowerCase() : "us";
                const storeSlug = (cleanAdvertiserName(advertiser.name || "") || advertiser.name || "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "");
                const publicStoreUrl = `/${country}/${storeSlug}`;

                return (
                  <a
                    href={publicStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-accent"
                    title="View public store page"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    View
                  </a>
                );
              })()}

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
        </div>
      )}

      {/* Deals & Promotions Section Header */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Deals &amp; Promotions
          </h2>
          <p className="text-xs text-gray-500">
            {dealsData ? `${dealsData.total} total deals stored for this merchant` : "Loading deals..."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: List / Grid */}
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

          {/* Store-Specific Research Button */}
          <button
            onClick={() => setIsResearchOpen(true)}
            disabled={!advertiser}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100 disabled:opacity-50"
            title={`Research active coupons & deals for ${advertiser?.name || 'merchant'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Research Deals (AI / n8n)
          </button>

          {/* Store-Specific Discovered Codes Badge Button */}
          <button
            onClick={() => setIsDiscoveredOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition ${
              pendingDiscoveredCount > 0
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 ring-1 ring-amber-400/40"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span>Discovered Codes</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                pendingDiscoveredCount > 0
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {pendingDiscoveredCount}
            </span>
          </button>

          {/* Add Deal Button */}
          <button
            onClick={handleAddDeal}
            disabled={!advertiser}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Deal
          </button>
        </div>
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
              {viewMode === "list" ? (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-card">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-600">
                      <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="py-3 pl-4 pr-3">Offer Title &amp; Details</th>
                          <th className="px-3 py-3">Type</th>
                          <th className="px-3 py-3">Code</th>
                          <th className="px-3 py-3">Discount</th>
                          <th className="px-3 py-3">Expiry Date</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {dealsData.deals.map((d) => {
                          const isVoucher = d.type === "voucher";
                          const isExpiring = d.endDate && new Date(d.endDate).getTime() < Date.now();

                          return (
                            <tr key={d.id} className="hover:bg-gray-50/70 transition">
                              <td className="py-3 pl-4 pr-3 max-w-sm">
                                <div className="font-semibold text-gray-900 leading-snug">
                                  {d.title}
                                </div>
                                {d.description && (
                                  <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                                    {d.description}
                                  </div>
                                )}
                                {d.isManual && (
                                  <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/50">
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {isVoucher ? (
                                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                    🎟️ Voucher
                                  </span>
                                ) : (
                                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    🏷️ Promotion
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {d.code ? (
                                  <div className="inline-flex items-center gap-1.5 rounded border border-dashed border-gray-300 bg-gray-50 px-2 py-0.5 font-mono text-xs font-bold text-gray-800">
                                    <span>{d.code}</span>
                                    <button
                                      onClick={() => copyCode(d.code!)}
                                      className="text-[10px] text-accent hover:underline font-normal"
                                      title="Copy code"
                                    >
                                      {copiedCode === d.code ? "✓ Copied" : "copy"}
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
                                    onClick={() => handleEditDeal(d)}
                                    title="Edit Deal"
                                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-accent transition"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDeal(d.id, d.title, d.network)}
                                    disabled={deletingDealId === d.id}
                                    title="Delete Deal"
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
              )}

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
        onSaved={() => {
          loadDeals(search, type, status, page);
          fetchAdvertiser();
        }}
        deal={selectedDeal}
        initialAdvertiser={
          advertiser
            ? {
                id: advertiser.id,
                name: advertiser.name,
                logoUrl: advertiser.logoUrl,
                network: advertiser.network,
                url: advertiser.url,
                region: advertiser.region,
                countryCode: advertiser.countryCode,
                countryCodes: advertiser.countryCodes,
              }
            : undefined
        }
      />

      {/* Store-Specific Discovered Deals Modal */}
      {advertiser && (
        <DiscoveredDealsModal
          isOpen={isDiscoveredOpen}
          onClose={() => setIsDiscoveredOpen(false)}
          storeFilter={{ id: advertiser.id, name: advertiser.name }}
          onDealApproved={() => {
            loadDeals(search, type, status, page);
            loadPendingCount();
            fetchAdvertiser();
          }}
        />
      )}

      {/* Store-Specific Research Modal */}
      {advertiser && (
        <ResearchDealsModal
          isOpen={isResearchOpen}
          onClose={() => setIsResearchOpen(false)}
          initialStore={{
            id: advertiser.id,
            name: advertiser.name,
            url: advertiser.url || undefined,
          }}
          onSuccess={() => {
            loadPendingCount();
            setIsDiscoveredOpen(true);
          }}
        />
      )}
    </main>
  );
}
