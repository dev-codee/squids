"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TransactionSummary } from "@/lib/transactions";
import { NETWORKS } from "@/lib/networks";

/** Last-30-days ISO date range for the overview snapshot. */
function last30Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: `${start.toISOString().slice(0, 10)}T00:00:00Z`,
    endDate: `${end.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

const QUICK_LINKS = [
  { label: "Deals", href: "/dashboard/deals" },
  { label: "Coupons", href: "/dashboard/coupons" },
  { label: "Products", href: "/dashboard/products" },
  { label: "Stores", href: "/dashboard/advertisers" },
];

/**
 * Cross-network overview. Aggregates a live snapshot from every connected
 * network (Awin today) and links out to each network's detailed dashboard.
 */
export default function DashboardOverviewPage() {
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { startDate, endDate } = last30Days();
    const params = new URLSearchParams({ startDate, endDate, page: "1", pageSize: "1" });
    fetch(`/api/transactions?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSummary(j?.summary ?? null))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const connected = NETWORKS.filter((n) => n.integrated).length;
  const currency = summary?.currency || "USD";

  const kpis = [
    {
      label: "Total Commission",
      value: summary ? formatMoney(summary.totalCommission, currency) : "—",
      hint: "Last 30 days · all networks",
    },
    {
      label: "Transactions",
      value: summary ? summary.totalTransactions.toLocaleString() : "—",
      hint: "Last 30 days",
    },
    {
      label: "Pending",
      value: summary ? summary.pendingCount.toLocaleString() : "—",
      hint: "Awaiting validation",
    },
    {
      label: "Networks Connected",
      value: `${connected}/${NETWORKS.length}`,
      hint: "Integrations live",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cross-network snapshot of your affiliate performance.
        </p>
      </header>

      {/* Combined KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-gray-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${loading && k.value === "—" ? "text-gray-300" : "text-gray-900"}`}>
              {k.value}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Networks */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Networks</h2>
        <Link href="/dashboard/networks" className="text-xs font-medium text-accent hover:underline">
          View all earnings →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NETWORKS.map((n) => (
          <Link
            key={n.slug}
            href={`/dashboard/networks/${n.slug}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-card transition hover:border-accent hover:shadow-card-hover"
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-bold ${n.accent}`}>
                {n.name}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  n.integrated ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${n.integrated ? "bg-emerald-500" : "bg-gray-400"}`} />
                {n.integrated ? "Connected" : "Pending"}
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-500 line-clamp-2">{n.description}</p>
            <span className="mt-4 inline-block text-xs font-medium text-accent group-hover:underline">
              Open dashboard →
            </span>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <h2 className="mt-8 mb-3 text-sm font-semibold text-gray-900">Manage store</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm font-medium text-gray-700 shadow-card transition hover:border-accent hover:text-accent"
          >
            {q.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
