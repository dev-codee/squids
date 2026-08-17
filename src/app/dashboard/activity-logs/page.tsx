"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";

interface ActivityLogItem {
  _id: string;
  type: string;
  title: string;
  description: string;
  network?: string;
  entity?: string;
  stats?: {
    created?: number;
    updated?: number;
    deleted?: number;
    total?: number;
  };
  status: "success" | "warning" | "error" | "info";
  timestamp: string;
}

interface SyncStatusItem {
  entity: string;
  lastSyncedAt: string;
  lastCount: number;
  status: "success" | "error";
  errorMessage?: string;
}

interface RecentStoreItem {
  id: number;
  name: string;
  network: string;
  logoUrl: string | null;
  relationship: string | null;
  region: string | null;
  countryCode?: string | null;
  syncedAt: string;
  dealCount?: number;
}

interface RecentDealItem {
  id: string | number;
  title: string;
  network: string;
  code: string | null;
  discountText: string | null;
  type: string;
  status: string;
  syncedAt: string;
  advertiser?: {
    id: number;
    name: string;
  };
}

interface ActivitySummary {
  totalLogs: number;
  errorLogs24h: number;
  storesJoined7d: number;
  dealsAdded24h: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

interface ApiResponse {
  logs: ActivityLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: ActivitySummary;
  syncStatus: SyncStatusItem[];
  recentStores: RecentStoreItem[];
  recentDeals: RecentDealItem[];
}

export default function ActivityLogsPage() {
  const [activeTab, setActiveTab] = useState<"audit" | "sync_status" | "recent_stores" | "recent_deals">("audit");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [triggeringSync, setTriggeringSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadData = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: "20",
      });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (networkFilter !== "all") params.set("network", networkFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/activity-logs?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load activity logs.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, networkFilter, statusFilter, search]);

  useEffect(() => {
    loadData(page);
  }, [loadData, page]);

  const handleManualSync = async () => {
    setTriggeringSync(true);
    setSyncMessage(null);
    try {
      // Trigger advertisers sync
      const advRes = await fetch("/api/cron/sync-advertisers?secret=" + (process.env.NEXT_PUBLIC_CRON_SECRET || ""));
      const dealsRes = await fetch("/api/cron/sync-deals?secret=" + (process.env.NEXT_PUBLIC_CRON_SECRET || ""));
      
      if (advRes.ok || dealsRes.ok) {
        setSyncMessage("Sync triggered successfully!");
        loadData(1);
      } else {
        setSyncMessage("Sync trigger sent. Check logs below for status.");
      }
    } catch (err) {
      setSyncMessage("Error triggering sync: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTriggeringSync(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Never";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return String(dateStr);
    }
  };

  const timeAgo = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    const elapsedMs = Date.now() - new Date(dateStr).getTime();
    if (elapsedMs < 0) return "Just now";
    const mins = Math.floor(elapsedMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "cron_sync":
        return "🔄";
      case "store_joined":
        return "🏬";
      case "deal_added":
        return "🏷️";
      case "deal_deleted":
        return "🗑️";
      case "store_updated":
        return "✏️";
      case "store_deleted":
        return "❌";
      default:
        return "📝";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">Success</span>;
      case "error":
        return <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-600/20">Failed</span>;
      case "warning":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">Warning</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">Info</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Activity Logs & Sync History
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor automated cron job syncs, newly joined stores, updated deals, and system events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {syncMessage && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              {syncMessage}
            </span>
          )}
          <button
            onClick={handleManualSync}
            disabled={triggeringSync}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={triggeringSync ? "animate-spin" : ""}>
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            {triggeringSync ? "Syncing..." : "Trigger Sync Now"}
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Last Sync */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Last Sync Executed</span>
            <span className="text-xl">🔄</span>
          </div>
          <p className="mt-2 text-lg font-bold text-gray-900">
            {timeAgo(data?.summary.lastSyncAt)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {formatDate(data?.summary.lastSyncAt)}
          </p>
        </div>

        {/* Card 2: Stores Joined */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Stores Joined (7 Days)</span>
            <span className="text-xl">🏬</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {data?.summary.storesJoined7d ?? 0}
          </p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">
            Active merchants in DB
          </p>
        </div>

        {/* Card 3: Deals Synced */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deals & Coupons (24h)</span>
            <span className="text-xl">🏷️</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {data?.summary.dealsAdded24h ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Ingested from active networks
          </p>
        </div>

        {/* Card 4: Sync Health */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">24h Sync Errors</span>
            <span className="text-xl">⚠️</span>
          </div>
          <p className={`mt-2 text-2xl font-bold ${data?.summary.errorLogs24h ? "text-red-600" : "text-emerald-600"}`}>
            {data?.summary.errorLogs24h ?? 0}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {data?.summary.errorLogs24h ? "Requires attention" : "All syncs healthy"}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab("audit")}
            className={`whitespace-nowrap pb-3 pt-1 border-b-2 text-sm font-semibold transition ${
              activeTab === "audit"
                ? "border-accent text-accent"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            📋 Activity Audit Trail ({data?.total ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("sync_status")}
            className={`whitespace-nowrap pb-3 pt-1 border-b-2 text-sm font-semibold transition ${
              activeTab === "sync_status"
                ? "border-accent text-accent"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            🔄 Cron Sync Matrix ({data?.syncStatus.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("recent_stores")}
            className={`whitespace-nowrap pb-3 pt-1 border-b-2 text-sm font-semibold transition ${
              activeTab === "recent_stores"
                ? "border-accent text-accent"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            🏬 Recently Joined Stores ({data?.recentStores.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("recent_deals")}
            className={`whitespace-nowrap pb-3 pt-1 border-b-2 text-sm font-semibold transition ${
              activeTab === "recent_deals"
                ? "border-accent text-accent"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            🏷️ Recent Deals ({data?.recentDeals.length ?? 0})
          </button>
        </nav>
      </div>

      {/* Filters (for Audit Trail) */}
      {activeTab === "audit" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search activity title, details, network..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-900 focus:border-accent focus:outline-none flex-1 min-w-[200px]"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-accent focus:outline-none bg-white"
            >
              <option value="all">All Event Types</option>
              <option value="cron_sync">Cron Syncs</option>
              <option value="store_joined">Stores Joined</option>
              <option value="deal_added">Deals Added</option>
              <option value="deal_deleted">Deals Deleted</option>
              <option value="store_updated">Store Updates</option>
            </select>
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-accent focus:outline-none bg-white"
            >
              <option value="all">All Networks</option>
              <option value="awin">Awin</option>
              <option value="admitad">Admitad</option>
              <option value="commission-factory">Commission Factory</option>
              <option value="kwanko">Kwanko</option>
              <option value="welcome">Welcome Deals</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 focus:border-accent focus:outline-none bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {(typeFilter !== "all" || networkFilter !== "all" || statusFilter !== "all" || search) && (
            <button
              onClick={() => {
                setTypeFilter("all");
                setNetworkFilter("all");
                setStatusFilter("all");
                setSearch("");
              }}
              className="text-xs font-medium text-accent hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          Loading activity logs...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          {/* Tab 1: Activity Audit Trail */}
          {activeTab === "audit" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Network</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No activity logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data?.logs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{typeIcon(log.type)}</span>
                            <span>{log.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <p className="line-clamp-2 text-gray-700">{log.description}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.network ? (
                            <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 border border-blue-100">
                              {log.network}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {statusBadge(log.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-gray-500">
                          <div>{timeAgo(log.timestamp)}</div>
                          <div className="text-[10px] text-gray-400">{formatDate(log.timestamp)}</div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {data && data.totalPages > 1 && (
                <div className="p-4 border-t border-gray-100">
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    total={data.total}
                    pageSize={data.pageSize}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Cron Sync Status Matrix */}
          {activeTab === "sync_status" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Sync Target Entity</th>
                    <th className="px-4 py-3">Last Synced</th>
                    <th className="px-4 py-3">Item Count</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Error (If Any)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.syncStatus.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No cron sync status recorded yet.
                      </td>
                    </tr>
                  ) : (
                    data?.syncStatus.map((sync) => {
                      const parts = sync.entity.split(":");
                      const net = parts.length > 1 ? parts[0] : "awin";
                      const ent = parts.length > 1 ? parts[1] : sync.entity;

                      return (
                        <tr key={sync.entity} className="hover:bg-gray-50/80 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <span className="uppercase font-bold text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {net}
                              </span>
                              <span className="capitalize text-sm font-semibold">{ent}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                            <div>{timeAgo(sync.lastSyncedAt)}</div>
                            <div className="text-[10px] text-gray-400">{formatDate(sync.lastSyncedAt)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-gray-900">
                            {sync.lastCount} items
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {statusBadge(sync.status)}
                          </td>
                          <td className="px-4 py-3 max-w-xs text-red-600 font-mono text-[11px] truncate">
                            {sync.errorMessage || <span className="text-gray-400 font-sans">None</span>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 3: Recently Joined Stores */}
          {activeTab === "recent_stores" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Store Name</th>
                    <th className="px-4 py-3">Network</th>
                    <th className="px-4 py-3">Region</th>
                    <th className="px-4 py-3">Active Offers</th>
                    <th className="px-4 py-3 text-right">Synced At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.recentStores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-400">
                        No recent stores found.
                      </td>
                    </tr>
                  ) : (
                    data?.recentStores.map((store) => (
                      <tr key={`${store.network}-${store.id}`} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                          <Link href={`/dashboard/advertisers/${store.id}`} className="flex items-center gap-3 group">
                            <div className="h-8 w-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {store.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={store.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                              ) : (
                                <span className="font-bold text-gray-400">{store.name.charAt(0)}</span>
                              )}
                            </div>
                            <span className="font-semibold text-gray-900 group-hover:text-accent transition">
                              {store.name}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 border border-blue-100">
                            {store.network || "awin"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">
                          {store.countryCode || store.region || "Global"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-emerald-600">
                          {store.dealCount ?? 0} offers
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-gray-500">
                          {formatDate(store.syncedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Recent Deals */}
          {activeTab === "recent_deals" && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs text-gray-600">
                <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3">Deal Title</th>
                    <th className="px-4 py-3">Store Name</th>
                    <th className="px-4 py-3">Network</th>
                    <th className="px-4 py-3">Promo Code</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3 text-right">Synced At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.recentDeals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No recent deals found.
                      </td>
                    </tr>
                  ) : (
                    data?.recentDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3 max-w-xs font-semibold text-gray-900 truncate">
                          {deal.title}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">
                          {deal.advertiser?.name ?? "Store"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 border border-blue-100">
                            {deal.network || "awin"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-amber-700">
                          {deal.code ? deal.code : <span className="text-gray-400 font-sans font-normal">Deal (No Code)</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-emerald-600">
                          {deal.discountText || "Discount"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-gray-500">
                          {formatDate(deal.syncedAt)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
