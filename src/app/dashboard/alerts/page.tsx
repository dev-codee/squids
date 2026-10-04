"use client";

import { useEffect, useState } from "react";
import type { AlertOperationsMetrics } from "@/lib/db/product-alerts";

export default function AlertsAdminPage() {
  const [metrics, setMetrics] = useState<AlertOperationsMetrics | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlertsData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/alerts");
      const data = await res.json();
      setMetrics(data.metrics || null);
      setAlerts(data.recentAlerts || []);
      setSubscribers(data.recentSubscribers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Alert Operations & Consent Desk</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Audit double opt-in consent records, target price subscriptions, and delivery queues.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchAlertsData}
          className="rounded-[9px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand"
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Confirmed Alerts
            </span>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">
              {metrics.confirmedAlerts}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Active price drop alerts</span>
          </div>
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Pending Confirmation
            </span>
            <p className="mt-2 text-3xl font-extrabold text-amber-600">
              {metrics.pendingAlerts}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Awaiting email verification</span>
          </div>
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Unsubscribed
            </span>
            <p className="mt-2 text-3xl font-extrabold text-slate-500">
              {metrics.unsubscribedAlerts}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Consent withdrawn</span>
          </div>
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Products Tracked
            </span>
            <p className="mt-2 text-3xl font-extrabold text-brand">
              {metrics.distinctProductsTracked}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Distinct catalog items</span>
          </div>
        </div>
      )}

      {/* Product Price Alerts Table */}
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">Product Price Alerts</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">No product price alerts recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3">Subscriber</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Target Price</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Consent Scope</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Last Notified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {alerts.map((a) => (
                  <tr key={a.id} className="hover:bg-canvas/50">
                    <td className="px-5 py-3.5 font-medium">{a.email}</td>
                    <td className="max-w-xs truncate px-5 py-3.5 text-xs text-ink" title={a.productTitle}>
                      {a.productTitle || `Product #${a.productId}`}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-brand">
                      {a.currency} {Number(a.targetPrice).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          a.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700"
                            : a.status === "pending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-ink-muted">
                      {a.consentScope} ({a.consentVersion})
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {a.lastNotifiedAt ? new Date(a.lastNotifiedAt).toLocaleDateString() : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Follow-Store Subscribers Table */}
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">Store Digest Subscribers</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading subscribers...</div>
        ) : subscribers.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">No store subscribers recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3">Subscriber</th>
                  <th className="px-5 py-3">Stores Followed</th>
                  <th className="px-5 py-3">Frequency</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Confirmed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {subscribers.map((s) => (
                  <tr key={s.email} className="hover:bg-canvas/50">
                    <td className="px-5 py-3.5 font-medium">{s.email}</td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {(s.stores || []).map((store: any) => store.name).join(", ") || "None"}
                    </td>
                    <td className="px-5 py-3.5 capitalize text-xs">{s.frequency}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          s.status === "confirmed"
                            ? "bg-emerald-50 text-emerald-700"
                            : s.status === "pending"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {s.confirmedAt ? new Date(s.confirmedAt).toLocaleDateString() : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
