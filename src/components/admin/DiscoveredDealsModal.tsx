"use client";

import { useEffect, useState, useMemo } from "react";
import type { DiscoveredDeal } from "@/lib/db/discovered-deals";

interface DiscoveredDealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDealApproved?: () => void;
  storeFilter?: {
    id: number;
    name: string;
  };
}

export default function DiscoveredDealsModal({
  isOpen,
  onClose,
  onDealApproved,
  storeFilter,
}: DiscoveredDealsModalProps) {
  const [deals, setDeals] = useState<DiscoveredDeal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    code: string;
    discountText: string;
    description: string;
    endDate: string;
  }>({ title: "", code: "", discountText: "", description: "", endDate: "" });

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function loadDeals() {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/admin/deals/discovered?status=pending&pageSize=100";
      if (storeFilter?.id) {
        url += `&advertiserId=${encodeURIComponent(storeFilter.id)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to fetch candidate deals.");
      setDeals(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading deals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadDeals();
      setEditingId(null);
      setSearchFilter("");
    }
  }, [isOpen, storeFilter?.id]);

  function startEdit(deal: DiscoveredDeal) {
    setEditingId(deal.candidateId);
    setEditForm({
      title: deal.title,
      code: deal.code || "",
      discountText: deal.discountText || "",
      description: deal.description || "",
      endDate: deal.endDate ? deal.endDate.split("T")[0] : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleApprove(deal: DiscoveredDeal, withOverrides = false) {
    setActionLoading(deal.candidateId);
    try {
      const overrides = withOverrides
        ? {
            title: editForm.title,
            code: editForm.code || null,
            discountText: editForm.discountText || null,
            description: editForm.description || null,
            endDate: editForm.endDate || null,
          }
        : undefined;

      const res = await fetch("/api/admin/deals/discovered/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: deal.candidateId,
          overrides,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to approve deal.");

      setDeals((prev) => prev.filter((d) => d.candidateId !== deal.candidateId));
      setTotal((prev) => Math.max(0, prev - 1));
      setEditingId(null);
      if (onDealApproved) onDealApproved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error approving deal.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(candidateId: string) {
    if (!confirm("Are you sure you want to dismiss this candidate coupon?")) return;
    setActionLoading(candidateId);
    try {
      const res = await fetch(`/api/admin/deals/discovered?candidateId=${encodeURIComponent(candidateId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to reject deal.");

      setDeals((prev) => prev.filter((d) => d.candidateId !== candidateId));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error rejecting deal.");
    } finally {
      setActionLoading(null);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const filteredDeals = useMemo(() => {
    if (!searchFilter.trim()) return deals;
    const q = searchFilter.toLowerCase();
    return deals.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.discountText && d.discountText.toLowerCase().includes(q)) ||
        (d.advertiser?.name && d.advertiser.name.toLowerCase().includes(q)) ||
        (d.description && d.description.toLowerCase().includes(q)),
    );
  }, [deals, searchFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl transition-all flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  {storeFilter ? `${storeFilter.name} — Discovered Deals` : "Discovered Coupons & Deals"}
                </h2>
                {storeFilter && (
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200/60">
                    Store #{storeFilter.id}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {storeFilter
                  ? `Active codes & discounts researched for ${storeFilter.name} (${total} pending review)`
                  : `Researched across RetailMeNot, CouponCabin, Slickdeals & web feeds (${total} pending review)`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDeals}
              title="Refresh candidate deals"
              className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 transition"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={loading ? "animate-spin" : ""}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter / Search toolbar */}
        {deals.length > 0 && (
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-6 py-2.5 shrink-0 gap-3">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by code, keyword, discount..."
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-purple-500 focus:outline-none"
              />
              <svg
                className="absolute left-2.5 top-2 text-gray-400"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="text-[11px] text-gray-500">
              Showing <span className="font-semibold text-gray-700">{filteredDeals.length}</span> of {total} deals
            </div>
          </div>
        )}

        {/* Modal Body - List View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
              {error}
            </div>
          )}

          {loading && deals.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <svg
                className="mx-auto h-8 w-8 animate-spin text-purple-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
              <p className="mt-3 text-xs font-medium">Loading discovered deals from MongoDB...</p>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800">
                {searchFilter ? "No matches found" : "Inbox is Clean!"}
              </h3>
              <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
                {searchFilter
                  ? "Try clearing your search query."
                  : storeFilter
                  ? `No pending candidate deals for ${storeFilter.name}. Click "Research Deals" to discover new codes for this store.`
                  : "No pending candidate coupons in staging. Use the \"Research Deals\" button to find active codes for any store."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {filteredDeals.map((deal) => {
                const isEditing = editingId === deal.candidateId;
                const isActing = actionLoading === deal.candidateId;

                return (
                  <div
                    key={deal.candidateId}
                    className={`p-3.5 sm:p-4 transition hover:bg-gray-50/70 ${
                      isEditing ? "bg-purple-50/30 ring-1 ring-purple-200" : ""
                    }`}
                  >
                    {/* Compact List Row */}
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Metadata Badges + Offer Title */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!storeFilter && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                              🏬 {deal.advertiser.name}
                            </span>
                          )}
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {deal.sourceName || "Web"}
                          </span>
                          {deal.type === "voucher" ? (
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              🎟️ Code
                            </span>
                          ) : (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              🏷️ Deal
                            </span>
                          )}
                          {deal.discountText && (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              {deal.discountText}
                            </span>
                          )}
                          {deal.endDate ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200/60">
                              📅 Exp: {new Date(deal.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 border border-gray-200/60">
                              📅 Ongoing
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-900 leading-snug">
                            {deal.title}
                          </h4>
                          {deal.description && (
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mt-0.5">
                              {deal.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Middle: Code badge */}
                      <div className="shrink-0 flex items-center gap-2">
                        {deal.code ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-purple-300 bg-purple-50/60 px-2.5 py-1">
                            <span className="text-xs font-mono font-bold tracking-wider text-purple-900">
                              {deal.code}
                            </span>
                            <button
                              onClick={() => copyCode(deal.code!)}
                              title="Copy code"
                              className="text-[10px] font-semibold text-purple-600 hover:text-purple-800 transition"
                            >
                              {copiedCode === deal.code ? "✓ Copied" : "Copy"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-gray-400 italic">
                            No code needed
                          </span>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-1 lg:pt-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={isActing}
                              onClick={() => handleApprove(deal, true)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              Save &amp; Add
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={isActing}
                              onClick={() => handleApprove(deal, false)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              {isActing ? "Adding..." : "Approve & Add"}
                            </button>
                            <button
                              onClick={() => startEdit(deal)}
                              title="Edit deal details"
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 hover:text-accent transition"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              disabled={isActing}
                              onClick={() => handleReject(deal.candidateId)}
                              title="Dismiss deal"
                              className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Edit Drawer */}
                    {isEditing && (
                      <div className="mt-3 pt-3 border-t border-purple-100 space-y-2 bg-white/70 p-3 rounded-lg">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium focus:border-purple-500 focus:outline-none"
                          placeholder="Deal title"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editForm.code}
                            onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs uppercase focus:border-purple-500 focus:outline-none font-mono"
                            placeholder="COUPON CODE (e.g. SAVE20)"
                          />
                          <input
                            type="text"
                            value={editForm.discountText}
                            onChange={(e) => setEditForm({ ...editForm, discountText: e.target.value })}
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                            placeholder="Discount (e.g. 20% OFF)"
                          />
                          <div>
                            <input
                              type="date"
                              value={editForm.endDate}
                              onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none text-gray-700"
                              title="Expiration Date"
                            />
                          </div>
                        </div>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                          placeholder="Deal description / terms"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 bg-gray-50/50 rounded-b-2xl shrink-0">
          <p className="text-xs text-gray-500">
            Approved deals automatically attach your store&apos;s affiliate tracking link.
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
