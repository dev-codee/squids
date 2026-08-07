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

  const [formData, setFormData] = useState({
    id: "",
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
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (deal) {
      setFormData({
        id: String(deal.id),
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
      });
    } else {
      setFormData({
        id: "",
        title: "",
        description: "",
        advertiserId: "",
        advertiserName: "",
        advertiserLogoUrl: "",
        type: "voucher",
        code: "",
        startDate: "",
        endDate: "",
        status: "active",
        trackingUrl: "",
        regionCodes: "",
      });
    }
    setError(null);
  }, [deal, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = "/api/admin/deals";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        id: formData.id ? Number(formData.id) : undefined,
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
            {/* Custom ID */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Deal ID</label>
              <input
                type="number"
                disabled={isEditing}
                placeholder="Auto-generated if blank"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
              />
            </div>

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
