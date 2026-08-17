"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals";

interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  deal: Deal | null; // null for Create, Deal for Edit
}

export default function DealModal({
  isOpen,
  onClose,
  onSaved,
  deal,
}: DealModalProps) {
  const isEditing = Boolean(deal);

  const emptyForm = {
    id: "",
    network: "awin",
    title: "",
    description: "",
    advertiserId: "",
    advertiserName: "",
    advertiserLogoUrl: "",
    type: "voucher" as "voucher" | "promotion",
    code: "",
    startDate: "",
    endDate: "",
    status: "active",
    trackingUrl: "",
    regionCodes: "",
    // AI-generated public copy
    aiTitle: "",
    aiDescription: "",
    // Enrichment (shared)
    discountText: "",
    isExclusive: false,
    // Coupon-only
    subtype: "code",
    cashbackRate: "",
    studentVerificationReq: "",
    // Promotion-only
    placement: "todays",
    imageUrl: "",
    originalPrice: "",
    salePrice: "",
    stockPercentage: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ status?: string; issues?: string[] } | null>(null);

  async function handleGenerateAi() {
    if (!deal) return;
    setAiGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/deals/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deal.id, network: deal.network, force: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate AI copy.");
      setFormData((f) => ({
        ...f,
        aiTitle: json.deal?.aiTitle || f.aiTitle,
        aiDescription: json.deal?.aiDescription || f.aiDescription,
      }));
      setAiInfo({ status: json.deal?.aiStatus, issues: json.deal?.aiIssues || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI copy.");
    } finally {
      setAiGenerating(false);
    }
  }

  useEffect(() => {
    if (deal) {
      setFormData({
        id: String(deal.id),
        network: deal.network || "awin",
        title: deal.title || "",
        description: deal.description || "",
        advertiserId: String(deal.advertiser.id || ""),
        advertiserName: deal.advertiser.name || "",
        advertiserLogoUrl: deal.advertiser.logoUrl || "",
        type: deal.type || "voucher",
        code: deal.code || "",
        startDate: deal.startDate ? deal.startDate.slice(0, 10) : "",
        endDate: deal.endDate ? deal.endDate.slice(0, 10) : "",
        status: deal.status || "active",
        trackingUrl: deal.trackingUrl || "",
        regionCodes: deal.regionCodes ? deal.regionCodes.join(", ") : "",
        aiTitle: deal.aiTitle || "",
        aiDescription: deal.aiDescription || "",
        discountText: deal.discountText || "",
        isExclusive: Boolean(deal.isExclusive),
        subtype: deal.subtype || "code",
        cashbackRate: deal.cashbackRate || "",
        studentVerificationReq: deal.studentVerificationReq || "",
        placement: deal.placement || "todays",
        imageUrl: deal.imageUrl || "",
        originalPrice: deal.originalPrice != null ? String(deal.originalPrice) : "",
        salePrice: deal.salePrice != null ? String(deal.salePrice) : "",
        stockPercentage: deal.stockPercentage != null ? String(deal.stockPercentage) : "",
      });
    } else {
      setFormData(emptyForm);
    }
    setError(null);
    setAiInfo(
      deal?.aiStatus ? { status: deal.aiStatus, issues: deal.aiIssues ?? [] } : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = "/api/admin/deals";
      const method = isEditing ? "PUT" : "POST";

      const isVoucher = formData.type === "voucher";

      const payload = {
        id: formData.id ? Number(formData.id) : undefined,
        network: formData.network || "awin",
        title: formData.title,
        description: formData.description || null,
        advertiser: {
          id: Number(formData.advertiserId),
          name: formData.advertiserName,
          logoUrl: formData.advertiserLogoUrl || null,
        },
        type: formData.type,
        code: formData.code || null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        status: formData.status,
        trackingUrl: formData.trackingUrl || null,
        regionCodes: formData.regionCodes
          ? formData.regionCodes.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
          : [],

        // AI-generated public copy (editable)
        aiTitle: formData.aiTitle || null,
        aiDescription: formData.aiDescription || null,

        // Shared enrichment
        discountText: formData.discountText || null,
        isExclusive: formData.isExclusive,

        // Voucher/coupon-only
        subtype: isVoucher ? formData.subtype : null,
        cashbackRate: isVoucher ? formData.cashbackRate || null : null,
        studentVerificationReq: isVoucher ? formData.studentVerificationReq || null : null,

        // Promotion/deal-only
        placement: !isVoucher ? formData.placement : null,
        imageUrl: !isVoucher ? formData.imageUrl || null : null,
        originalPrice: !isVoucher ? formData.originalPrice || null : null,
        salePrice: !isVoucher ? formData.salePrice || null : null,
        stockPercentage: !isVoucher ? formData.stockPercentage || null : null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save deal.");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Edit Deal / Promotion (#${deal?.id})` : "Add New Deal / Promotion"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Deal ID — read-only reference, only shown when editing.
                New deals get an auto-generated ID on the server. */}
            {isEditing && (
              <div>
                <label className="block text-xs font-medium text-gray-700">Deal ID</label>
                <input
                  type="number"
                  disabled
                  value={formData.id}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
            )}

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Deal Type *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as "voucher" | "promotion" })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="voucher">Voucher / Coupon Code</option>
                <option value="promotion">General Promotion</option>
              </select>
            </div>

            {/* Title */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. 20% Off All Orders"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed terms or offer explanation..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Advertiser ID */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Advertiser ID *</label>
              <input
                type="number"
                required
                value={formData.advertiserId}
                onChange={(e) => setFormData({ ...formData, advertiserId: e.target.value })}
                placeholder="e.g. 1001"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Advertiser Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Advertiser Name *</label>
              <input
                type="text"
                required
                value={formData.advertiserName}
                onChange={(e) => setFormData({ ...formData, advertiserName: e.target.value })}
                placeholder="e.g. Nike"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Advertiser Logo */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Advertiser Logo URL</label>
              <input
                type="url"
                value={formData.advertiserLogoUrl}
                onChange={(e) => setFormData({ ...formData, advertiserLogoUrl: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Voucher Code */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Voucher / Promo Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SAVE20"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase font-mono"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="active">Active</option>
                <option value="expiringSoon">Expiring Soon</option>
                <option value="upcoming">Upcoming</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700">End Date (Expiration)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Tracking Link */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Tracking / Affiliate URL</label>
              <input
                type="url"
                value={formData.trackingUrl}
                onChange={(e) => setFormData({ ...formData, trackingUrl: e.target.value })}
                placeholder="https://www.awin1.com/cread.php?..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Region Codes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Region / Country Codes (comma separated)</label>
              <input
                type="text"
                value={formData.regionCodes}
                onChange={(e) => setFormData({ ...formData, regionCodes: e.target.value })}
                placeholder="e.g. US, GB, PK (leave blank for all)"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
              />
            </div>

            {/* -------- AI-generated public copy -------- */}
            <div className="sm:col-span-2 mt-2 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    AI Copy (shown on public pages)
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    When set, these replace the raw title/description on public pages.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={!isEditing || aiGenerating}
                  title={!isEditing ? "Save the deal first, then generate" : "Generate with Claude"}
                  className="rounded-lg border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent hover:text-white transition disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-accent"
                >
                  {aiGenerating ? "Generating…" : "✨ Generate with AI"}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">AI Title</label>
              <input
                type="text"
                value={formData.aiTitle}
                onChange={(e) => setFormData({ ...formData, aiTitle: e.target.value })}
                placeholder="Generated or hand-written shopper-facing title"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">AI Description</label>
              <textarea
                rows={3}
                value={formData.aiDescription}
                onChange={(e) => setFormData({ ...formData, aiDescription: e.target.value })}
                placeholder="Generated or hand-written shopper-facing description"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {aiInfo?.status && (
              <div className="sm:col-span-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    aiInfo.status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700"
                      : aiInfo.status === "CORRECTED"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  QC: {aiInfo.status}
                </span>
                {aiInfo.issues && aiInfo.issues.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[11px] text-gray-500">
                    {aiInfo.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
                {aiInfo.status === "REVIEW" && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Offer data was insufficient — public pages will show the raw title/description.
                  </p>
                )}
              </div>
            )}

            {/* -------- Public page enrichment -------- */}
            <div className="sm:col-span-2 mt-2 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Public Page Display
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Controls how this offer looks on the public store pages.
              </p>
            </div>

            {/* Discount label (shared) */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Discount Label</label>
              <input
                type="text"
                value={formData.discountText}
                onChange={(e) => setFormData({ ...formData, discountText: e.target.value })}
                placeholder="e.g. 20% OFF, $15 OFF"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Exclusive flag (shared) */}
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={formData.isExclusive}
                  onChange={(e) => setFormData({ ...formData, isExclusive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                />
                Mark as Exclusive
              </label>
            </div>

            {formData.type === "voucher" ? (
              <>
                {/* Coupon subtype */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">Coupon Category</label>
                  <select
                    value={formData.subtype}
                    onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="code">Standard Promo Code</option>
                    <option value="student">Student Discount</option>
                    <option value="cashback">Cashback Offer</option>
                  </select>
                </div>

                {/* Cashback rate (only meaningful for cashback) */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">Cashback Rate</label>
                  <input
                    type="text"
                    value={formData.cashbackRate}
                    onChange={(e) => setFormData({ ...formData, cashbackRate: e.target.value })}
                    placeholder="e.g. 8% Flat Cashback"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Student verification requirement */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Student Verification Requirement</label>
                  <input
                    type="text"
                    value={formData.studentVerificationReq}
                    onChange={(e) => setFormData({ ...formData, studentVerificationReq: e.target.value })}
                    placeholder="e.g. Valid .edu email or UNiDAYS verification"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Deal placement */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">Deal Section</label>
                  <select
                    value={formData.placement}
                    onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    <option value="todays">Today&apos;s Deals</option>
                    <option value="lightning">Lightning Deal</option>
                    <option value="limited">Limited-Time Offer</option>
                    <option value="trending">Trending Discount</option>
                  </select>
                </div>

                {/* Stock percentage (lightning) */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">Stock Claimed % (lightning)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formData.stockPercentage}
                    onChange={(e) => setFormData({ ...formData, stockPercentage: e.target.value })}
                    placeholder="0 – 100"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Product image */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Product Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Original price */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">Original Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                    placeholder="e.g. 249.00"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>

                {/* Sale price */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">Sale Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    placeholder="e.g. 189.00"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
