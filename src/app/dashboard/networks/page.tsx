"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NETWORKS } from "@/lib/networks";
import ModuleScaffold from "@/components/admin/ModuleScaffold";

export const dynamic = "force-dynamic";

interface NetworkEarnings {
  network: string;
  totalCommission: number;
  pendingCommission: number;
  approvedCommission: number;
  transactionCount: number;
  pendingCount: number;
  approvedCount: number;
  declinedCount: number;
  currency: string;
}

interface EarningsData {
  combined: NetworkEarnings;
  networks: NetworkEarnings[];
}

function formatCurrency(value: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Accumulated earnings across every affiliate network. Fetches live figures
 * from `/api/networks/earnings`.
 */
export default function NetworksOverviewPage() {
  const connected = NETWORKS.filter((n) => n.integrated).length;

  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/networks/earnings")
      .then((res) => res.json())
      .then((json) => {
        if (json.combined) setData(json);
      })
      .catch((err) => console.error("Failed to load earnings:", err))
      .finally(() => setLoading(false));
  }, []);

  // Build a lookup from network slug → earnings
  const earningsMap = new Map<string, NetworkEarnings>();
  if (data) {
    for (const ne of data.networks) {
      earningsMap.set(ne.network, ne);
    }
  }

  const KPIS = [
    {
      label: "Total Earnings",
      hint: "Accumulated across all networks",
      value: data ? formatCurrency(data.combined.totalCommission, data.combined.currency) : null,
    },
    {
      label: "Pending Commission",
      hint: "Awaiting validation",
      value: data ? formatCurrency(data.combined.pendingCommission, data.combined.currency) : null,
    },
    {
      label: "Approved Commission",
      hint: "Confirmed earnings",
      value: data ? formatCurrency(data.combined.approvedCommission, data.combined.currency) : null,
    },
    {
      label: "Conversions",
      hint: "All networks, all time",
      value: data ? data.combined.transactionCount.toLocaleString() : null,
    },
  ];

  return (
    <ModuleScaffold
      title="All Networks — Earnings"
      description="Combined performance across every connected affiliate network."
      badge={{
        label: `${connected}/${NETWORKS.length} connected`,
        className: "bg-accent-soft text-accent",
      }}
    >
      {/* Combined KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
            <p className="text-xs font-medium text-gray-500">{k.label}</p>
            {loading ? (
              <div className="mt-1 h-8 w-24 animate-pulse rounded bg-gray-100" />
            ) : (
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {k.value ?? "—"}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">{k.hint}</p>
          </div>
        ))}
      </div>

      {/* Per-network breakdown */}
      <h2 className="mt-8 mb-3 text-sm font-semibold text-gray-900">Networks</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NETWORKS.map((n) => {
          const ne = earningsMap.get(n.slug);
          return (
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
              <div className="mt-4 flex items-baseline justify-between">
                {loading ? (
                  <div className="h-7 w-20 animate-pulse rounded bg-gray-100" />
                ) : ne ? (
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(ne.totalCommission, ne.currency)}
                  </span>
                ) : (
                  <span className="text-lg font-bold text-gray-300">—</span>
                )}
                <span className="text-xs font-medium text-accent group-hover:underline">
                  View dashboard →
                </span>
              </div>
              {ne && (
                <div className="mt-2 flex gap-3 text-[10px] text-gray-400">
                  <span>{ne.transactionCount} conversions</span>
                  <span>·</span>
                  <span>{ne.approvedCount} approved</span>
                  <span>·</span>
                  <span>{ne.pendingCount} pending</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </ModuleScaffold>
  );
}
