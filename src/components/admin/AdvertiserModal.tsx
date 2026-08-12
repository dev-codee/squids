"use client";

import { useEffect, useState } from "react";
import type { Advertiser } from "@/lib/awin";

interface AdvertiserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  advertiser: Advertiser | null; // null for Create, Advertiser for Edit
}

export default function AdvertiserModal({
  isOpen,
  onClose,
  onSaved,
  advertiser,
}: AdvertiserModalProps) {
  const isEditing = Boolean(advertiser);

  const [formData, setFormData] = useState({
    id: "",
    name: "",
    logoUrl: "",
    status: "active",
    relationship: "joined",
    region: "",
    countryCode: "",
    currencyCode: "",
    commission: "",
    url: "",
    description: "",
    bannerUrl: "",
    categories: "",
    avgSavings: "",
    rating: "",
    isFlagship: false,
    isGlobal: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (advertiser) {
      setFormData({
        id: String(advertiser.id),
        name: advertiser.name || "",
        logoUrl: advertiser.logoUrl || "",
        status: advertiser.status || "active",
        relationship: advertiser.relationship || "joined",
        region: advertiser.region || "",
        countryCode: advertiser.countryCode || "",
        currencyCode: advertiser.currencyCode || "",
        commission: advertiser.commission || "",
        url: advertiser.url || "",
        description: advertiser.description || "",
        bannerUrl: advertiser.bannerUrl || "",
        categories: advertiser.categories?.join(", ") || "",
        avgSavings: advertiser.avgSavings || "",
        rating: advertiser.rating !== undefined ? String(advertiser.rating) : "",
        isFlagship: advertiser.isFlagship || false,
        isGlobal: advertiser.isGlobal || false,
      });
    } else {
      setFormData({
        id: "",
        name: "",
        logoUrl: "",
        status: "active",
        relationship: "joined",
        region: "",
        countryCode: "",
        currencyCode: "",
        commission: "",
        url: "",
        description: "",
        bannerUrl: "",
        categories: "",
        avgSavings: "",
        rating: "",
        isFlagship: false,
        isGlobal: false,
      });
    }
    setError(null);
  }, [advertiser, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = "/api/admin/advertisers";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        ...formData,
        categories: formData.categories
          ? formData.categories.split(",").map((c) => c.trim()).filter(Boolean)
          : [],
        rating: formData.rating ? Number(formData.rating) : undefined,
        isFlagship: formData.isFlagship,
        isGlobal: formData.isGlobal,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save advertiser.");
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
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Edit Advertiser (#${advertiser?.id})` : "Add New Advertiser"}
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
            {/* Custom ID (Optional for new) */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Advertiser ID</label>
              <input
                type="number"
                disabled={isEditing}
                placeholder="Auto-generated if blank"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Relationship */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Relationship</label>
              <select
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="joined">Joined</option>
                <option value="pending">Pending</option>
                <option value="notjoined">Not Joined</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Status</label>
              <input
                type="text"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                placeholder="e.g. active"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Logo URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Logo Image URL</label>
              <input
                type="url"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Target URL */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Click-through / Display URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Region / Country */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Region Name</label>
              <input
                type="text"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g. United States"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Country Code (2 letters)</label>
              <input
                type="text"
                maxLength={2}
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                placeholder="e.g. US, PK, GB"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
              />
            </div>

            {/* Commission & Currency */}
            <div>
              <label className="block text-xs font-medium text-gray-700">Commission Rate</label>
              <input
                type="text"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                placeholder="e.g. 5%, $10"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Currency Code</label>
              <input
                type="text"
                maxLength={3}
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value.toUpperCase() })}
                placeholder="USD, EUR, GBP"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
              />
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Store Metadata (SEO & Public Page)</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700">SEO Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter a description for the public store page..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Banner Image URL</label>
                <input
                  type="url"
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Categories (comma-separated)</label>
                <input
                  type="text"
                  value={formData.categories}
                  onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                  placeholder="e.g. Electronics, Fashion, Home"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Manual Rating Override (1-5)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                  placeholder="e.g. 4.8"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Average Savings</label>
                <input
                  type="text"
                  value={formData.avgSavings}
                  onChange={(e) => setFormData({ ...formData, avgSavings: e.target.value })}
                  placeholder="e.g. 15%"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="flex items-center gap-3 sm:col-span-2 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  id="isFlagship"
                  checked={formData.isFlagship}
                  onChange={(e) => setFormData({ ...formData, isFlagship: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                />
                <label htmlFor="isFlagship" className="text-sm font-medium text-gray-900 cursor-pointer">
                  ⭐ Mark as Flagship Store
                  <span className="block text-xs text-gray-500 font-normal">Flagship stores always appear at the top of the region&apos;s home page.</span>
                </label>
              </div>

              <div className="flex items-center gap-3 sm:col-span-2 pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  id="isGlobal"
                  checked={formData.isGlobal}
                  onChange={(e) => setFormData({ ...formData, isGlobal: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                />
                <label htmlFor="isGlobal" className="text-sm font-medium text-gray-900 cursor-pointer">
                  🌍 Mark as Global Advertiser
                  <span className="block text-xs text-gray-500 font-normal">Global advertisers will automatically appear on all country pages (e.g. /pk, /de) regardless of their specific country code.</span>
                </label>
              </div>
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
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Advertiser"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
