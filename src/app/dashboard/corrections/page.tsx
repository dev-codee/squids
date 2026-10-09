"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  CorrectionTicket,
  CorrectionStatus,
  DisputeType,
} from "@/lib/model/correction";

export default function CorrectionsAdminPage() {
  const [items, setItems] = useState<CorrectionTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{
    pending: number;
    reviewing: number;
    resolved: number;
    rejected: number;
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // Resolution modal state
  const [selectedTicket, setSelectedTicket] = useState<CorrectionTicket | null>(null);
  const [actionStatus, setActionStatus] = useState<CorrectionStatus>("resolved");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [reviewerName, setReviewerName] = useState("editorial_staff");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("disputeType", typeFilter);
      params.set("limit", "50");

      const res = await fetch(`/api/corrections?${params.toString()}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
    } catch (err) {
      console.error("[dashboard/corrections] Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchCorrections();
  }, [fetchCorrections]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setUpdating(true);
    setUpdateError(null);
    try {
      const res = await fetch("/api/corrections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTicket.id,
          status: actionStatus,
          resolutionNotes: resolutionNotes.trim() || undefined,
          reviewedBy: reviewerName.trim() || "editorial_staff",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update ticket");
      }

      setSelectedTicket(null);
      setResolutionNotes("");
      await fetchCorrections();
    } catch (err: any) {
      setUpdateError(err?.message || "Failed to update ticket");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status: CorrectionStatus) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "reviewing":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "resolved":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "rejected":
        return "bg-rose-100 text-rose-800 border-rose-300";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Corrections & Disputes Desk</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage user and retailer reported catalog discrepancies, wrong product matches, and expired promotions.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchCorrections}
          className="rounded-[9px] border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand"
        >
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Pending Tickets
            </span>
            <p className="mt-2 text-3xl font-extrabold text-amber-600">
              {stats.pending}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Awaiting triage</span>
          </div>

          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Under Review
            </span>
            <p className="mt-2 text-3xl font-extrabold text-blue-600">
              {stats.reviewing}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Active investigation</span>
          </div>

          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Resolved
            </span>
            <p className="mt-2 text-3xl font-extrabold text-emerald-600">
              {stats.resolved}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Verified & rectified</span>
          </div>

          <div className="rounded-card border border-line bg-white p-5 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Rejected / Closed
            </span>
            <p className="mt-2 text-3xl font-extrabold text-ink-muted">
              {stats.rejected}
            </p>
            <span className="mt-1 block text-xs text-ink-muted">Deemed invalid</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold text-ink-soft">
          Status:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded-[7px] border border-line bg-canvas px-2.5 py-1 text-xs text-ink"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewing">Under Review</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-ink-soft">
          Type:
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="ml-2 rounded-[7px] border border-line bg-canvas px-2.5 py-1 text-xs text-ink"
          >
            <option value="">All Types</option>
            <option value="wrong_match">Wrong Match</option>
            <option value="wrong_price">Wrong Price</option>
            <option value="expired_deal">Expired Deal</option>
            <option value="broken_link">Broken Link</option>
            <option value="merchant_info">Merchant Info</option>
            <option value="other">Other</option>
          </select>
        </label>

        <span className="ml-auto text-xs text-ink-muted">
          Showing {items.length} of {total} tickets
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-muted">Loading tickets…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            No correction tickets match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-canvas text-ink-muted font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Ticket / Date</th>
                  <th className="px-4 py-3">Type & Market</th>
                  <th className="px-4 py-3">Target Context</th>
                  <th className="px-4 py-3">Discrepancy Note</th>
                  <th className="px-4 py-3">Reporter</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-brand-soft/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-[11px] text-ink font-semibold">
                      {ticket.id}
                      <span className="block font-sans font-normal text-ink-muted text-[10px] mt-0.5">
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ink uppercase">
                        {ticket.disputeType.replace("_", " ")}
                      </span>
                      <span className="ml-1.5 rounded bg-canvas px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                        {ticket.country}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {ticket.productTitle && (
                        <span className="block truncate max-w-[160px] font-medium text-ink" title={ticket.productTitle}>
                          {ticket.productTitle}
                        </span>
                      )}
                      {ticket.productId && (
                        <span className="block text-[10px] font-mono text-ink-muted">
                          Product #{ticket.productId}
                        </span>
                      )}
                      {ticket.dealId && (
                        <span className="block text-[10px] font-mono text-ink-muted">
                          Deal #{ticket.dealId}
                        </span>
                      )}
                      {ticket.storeSlug && (
                        <span className="block text-[10px] font-mono text-ink-muted">
                          Store: {ticket.storeSlug}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="line-clamp-2 text-ink" title={ticket.description}>
                        {ticket.description}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {ticket.reporterEmail ? (
                        <span className="truncate max-w-[120px] block" title={ticket.reporterEmail}>
                          {ticket.reporterEmail}
                        </span>
                      ) : (
                        <span className="italic">Anonymous</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${getStatusBadge(
                          ticket.status,
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setActionStatus(
                            ticket.status === "pending"
                              ? "reviewing"
                              : ticket.status === "reviewing"
                                ? "resolved"
                                : ticket.status,
                          );
                          setResolutionNotes(ticket.resolutionNotes || "");
                        }}
                        className="rounded-[6px] border border-line bg-white px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm hover:border-brand hover:text-brand"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-card border border-line bg-white p-6 shadow-card-hover animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold text-ink">
                Manage Ticket: {selectedTicket.id}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-ink-soft">
              <div>
                <span className="font-semibold text-ink">Dispute Type: </span>
                <span className="uppercase font-semibold text-brand">
                  {selectedTicket.disputeType.replace("_", " ")}
                </span>{" "}
                ({selectedTicket.country})
              </div>
              {selectedTicket.productTitle && (
                <div>
                  <span className="font-semibold text-ink">Target Product: </span>
                  {selectedTicket.productTitle} (#{selectedTicket.productId})
                </div>
              )}
              {selectedTicket.pageUrl && (
                <div>
                  <span className="font-semibold text-ink">Reported URL: </span>
                  <a
                    href={selectedTicket.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand hover:underline"
                  >
                    {selectedTicket.pageUrl}
                  </a>
                </div>
              )}
              <div className="rounded-card border border-line bg-canvas p-3">
                <span className="font-semibold text-ink block mb-1">
                  Reported Discrepancy:
                </span>
                <p className="text-ink whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateStatus} className="mt-5 space-y-4">
              {updateError && (
                <div className="rounded border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-800">
                  {updateError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-ink">
                  Update Lifecycle Status
                </label>
                <select
                  value={actionStatus}
                  onChange={(e) => setActionStatus(e.target.value as CorrectionStatus)}
                  className="mt-1 w-full rounded-[7px] border border-line bg-white p-2 text-xs text-ink"
                >
                  <option value="pending">Pending (Revert to queue)</option>
                  <option value="reviewing">Under Review (Assigned)</option>
                  <option value="resolved">Resolved (Offer quarantined/updated)</option>
                  <option value="rejected">Rejected (Not a valid discrepancy)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  Resolution Notes & Audit Reason
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail actions taken (e.g. split variant, quarantined outdated offer, updated coupon expiry)..."
                  className="mt-1 w-full rounded-[7px] border border-line p-2 text-xs text-ink placeholder:text-ink-muted"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink">
                  Reviewer Identifier
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  className="mt-1 w-full rounded-[7px] border border-line p-2 text-xs text-ink"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="rounded-[7px] border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-[7px] bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  {updating ? "Saving…" : "Save Resolution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
