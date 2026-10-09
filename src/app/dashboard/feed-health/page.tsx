"use client";

import { useEffect, useState } from "react";
import type { FeedHealthItem } from "@/lib/db/snapshots";
import type { FeedFailureRecord } from "@/lib/model/feedSnapshot";

export default function FeedHealthPage() {
  const [overview, setOverview] = useState<FeedHealthItem[]>([]);
  const [failures, setFailures] = useState<FeedFailureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feed-health");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load feed health");
      setOverview(data.overview || []);
      setFailures(data.failures || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const totalFeeds = overview.length;
  const healthyFeeds = overview.filter((f) => f.lastStatus === "success").length;
  const totalDeadLetters = overview.reduce((acc, f) => acc + f.deadLetterCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Feed Health & Ingestion Desk</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Immutable snapshot monitoring, freshness tracking, and dead-letter recovery.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchHealth}
          className="rounded-[9px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand"
        >
          Refresh Feeds
        </button>
      </div>

      {error && (
        <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-line bg-white p-5 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Monitored Feeds
          </span>
          <p className="mt-2 text-3xl font-extrabold text-ink">{totalFeeds}</p>
          <span className="mt-1 block text-xs text-ink-muted">Across 4 affiliate networks</span>
        </div>
        <div className="rounded-card border border-line bg-white p-5 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Healthy Status
          </span>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600">
            {healthyFeeds} / {totalFeeds}
          </p>
          <span className="mt-1 block text-xs text-ink-muted">Last sync successful</span>
        </div>
        <div className="rounded-card border border-line bg-white p-5 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            Dead-Letter Failures
          </span>
          <p className="mt-2 text-3xl font-extrabold text-amber-600">{totalDeadLetters}</p>
          <span className="mt-1 block text-xs text-ink-muted">Max retries exceeded</span>
        </div>
      </div>

      {/* Feeds Table */}
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">Feed Ingestion Streams</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading feed status...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3">Network</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Fetch</th>
                  <th className="px-5 py-3">Record Count</th>
                  <th className="px-5 py-3">Last-Good Snapshot</th>
                  <th className="px-5 py-3">Failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.map((item) => (
                  <tr key={`${item.network}:${item.entity}`} className="hover:bg-canvas/50">
                    <td className="px-5 py-3.5 font-semibold capitalize">{item.network}</td>
                    <td className="px-5 py-3.5 font-mono text-xs">{item.entity}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.lastStatus === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.lastStatus === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.lastStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {item.lastFetchedAt ? new Date(item.lastFetchedAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-5 py-3.5 font-semibold">
                      {item.lastRecordCount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {item.lastGoodFetchedAt
                        ? `${new Date(item.lastGoodFetchedAt).toLocaleDateString()} (${item.lastGoodRecordCount.toLocaleString()} records)`
                        : "None"}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.recentFailures > 0 ? (
                        <span className="font-semibold text-red-600">
                          {item.recentFailures} ({item.deadLetterCount} dead)
                        </span>
                      ) : (
                        <span className="text-emerald-600">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Failures & Dead-Letter Log */}
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-bold text-ink">Failure & Dead-Letter Queue</h2>
        </div>
        {failures.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            No active feed failures recorded. All sync operations are healthy.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-ink">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Feed</th>
                  <th className="px-5 py-3">Batch ID</th>
                  <th className="px-5 py-3">Error</th>
                  <th className="px-5 py-3">Retries</th>
                  <th className="px-5 py-3">Dead-Letter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {failures.map((f) => (
                  <tr key={f.id} className="hover:bg-canvas/50">
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {new Date(f.failedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-semibold capitalize">
                      {f.network}:{f.entity}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">{f.batchId}</td>
                    <td className="max-w-xs truncate px-5 py-3.5 text-xs text-red-700" title={f.error}>
                      {f.error}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold">{f.retryCount} / 5</td>
                    <td className="px-5 py-3.5">
                      {f.deadLetter ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">
                          DEAD-LETTER
                        </span>
                      ) : (
                        <span className="text-xs text-amber-700">Retrying</span>
                      )}
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
