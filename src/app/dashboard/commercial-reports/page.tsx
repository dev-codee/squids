"use client";

import { useEffect, useState } from "react";
import type { CommercialReportData } from "@/app/api/admin/reports/commercial/route";

export default function CommercialReportsPage() {
  const [data, setData] = useState<CommercialReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reports/commercial");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load report");
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Commercial & EPC Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Approved commission per session, EPC performance, order reversals, and mature contribution.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchReport}
          className="rounded-[9px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand"
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-ink-muted">Aggregating commercial transactions...</div>
      ) : data ? (
        <>
          {/* Key KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Approved Commission
              </span>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">
                ${data.approvedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="mt-1 block text-xs text-ink-muted">
                {data.approvedOrders} orders confirmed
              </span>
            </div>

            <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Earnings Per Click (EPC)
              </span>
              <p className="mt-2 text-3xl font-extrabold text-brand">
                ${data.averageEpc.toFixed(3)}
              </p>
              <span className="mt-1 block text-xs text-ink-muted">
                Across {data.totalClicks.toLocaleString()} outbound clicks
              </span>
            </div>

            <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Pending Pipeline
              </span>
              <p className="mt-2 text-3xl font-extrabold text-amber-600">
                ${data.pendingRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="mt-1 block text-xs text-ink-muted">Awaiting merchant validation</span>
            </div>

            <div className="rounded-card border border-line bg-white p-5 shadow-card">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Average Order Value
              </span>
              <p className="mt-2 text-3xl font-extrabold text-ink">
                ${data.averageOrderValue.toFixed(2)}
              </p>
              <span className="mt-1 block text-xs text-ink-muted">Per basket checkout</span>
            </div>
          </div>

          {/* Grids: Networks and Top Merchants */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Network Contribution */}
            <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-base font-bold text-ink">Network Revenue Contribution</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-5 py-3">Network</th>
                      <th className="px-5 py-3">Orders</th>
                      <th className="px-5 py-3 text-right">Approved Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.networkBreakdown.map((n) => (
                      <tr key={n.network} className="hover:bg-canvas/50">
                        <td className="px-5 py-3.5 font-semibold capitalize">{n.network}</td>
                        <td className="px-5 py-3.5">{n.orders}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                          ${n.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Merchants */}
            <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
              <div className="border-b border-line px-5 py-4">
                <h2 className="text-base font-bold text-ink">Top Performing Retailers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-5 py-3">Retailer</th>
                      <th className="px-5 py-3">Orders</th>
                      <th className="px-5 py-3 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.topMerchants.map((m) => (
                      <tr key={m.name} className="hover:bg-canvas/50">
                        <td className="px-5 py-3.5 font-semibold">{m.name}</td>
                        <td className="px-5 py-3.5">{m.orders}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-brand">
                          ${m.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Reversal Reasons & Lost Commission */}
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-base font-bold text-ink">Reversal & Cancellation Analysis</h2>
            </div>
            {data.reversalReasons.length === 0 ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                No declined orders recorded. 100% approval rate.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                  <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-5 py-3">Decline / Reversal Reason</th>
                      <th className="px-5 py-3">Declined Orders</th>
                      <th className="px-5 py-3 text-right">Lost Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.reversalReasons.map((r) => (
                      <tr key={r.reason} className="hover:bg-canvas/50">
                        <td className="px-5 py-3.5 font-medium text-ink">{r.reason}</td>
                        <td className="px-5 py-3.5 text-xs text-red-600 font-semibold">{r.count}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-sm text-red-600">
                          -${r.lostCommission.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
