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
    network: "awin",
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
    isPPC: false,
    countryCodes: "",
    seoTitle: "",
    seoDescription: "",
    maxDiscount: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableCategories, setAvailableCategories] = useState<{ id?: string; name: string; slug: string; icon?: string }[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [storePageJson, setStorePageJson] = useState("");

  async function handleGenerateStorePage() {
    if (!advertiser) return;
    setAiBusy(true);
    setAiMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/advertisers/generate-store-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: advertiser.id,
          network: advertiser.network,
          country: advertiser.countryCode || undefined,
          force: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate store page.");
      if (json.storePage) {
        setStorePageJson(JSON.stringify(json.storePage, null, 2));
      }
      setAiMsg(json.generated ? "Store page generated ✓ (review & Save)" : "No content generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate store page.");
    } finally {
      setAiBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setAvailableCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (advertiser) {
      setFormData({
        id: String(advertiser.id),
        network: advertiser.network || "awin",
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
        isPPC: advertiser.isPPC || false,
        countryCodes: advertiser.countryCodes?.join(", ") || "",
        seoTitle: advertiser.seoTitle || "",
        seoDescription: advertiser.seoDescription || "",
        maxDiscount: advertiser.maxDiscount || "",
      });
    } else {
      setFormData({
        id: "",
        network: "awin",
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
        isPPC: false,
        countryCodes: "",
        seoTitle: "",
        seoDescription: "",
        maxDiscount: "",
      });
    }
    setStorePageJson(
      advertiser?.aiStorePage ? JSON.stringify(advertiser.aiStorePage, null, 2) : "",
    );
    setAiMsg(null);
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

      // Store-page content (edited JSON) — only sent when editing.
      let aiStorePage: unknown = undefined;
      if (isEditing) {
        const t = storePageJson.trim();
        if (t === "") {
          aiStorePage = null;
        } else {
          try {
            aiStorePage = JSON.parse(t);
          } catch {
            throw new Error("Store Page Content is not valid JSON — fix it or clear the field.");
          }
        }
      }

      const payload = {
        ...formData,
        categories: formData.categories
          ? formData.categories.split(",").map((c) => c.trim()).filter(Boolean)
          : [],
        rating: formData.rating ? Number(formData.rating) : undefined,
        isFlagship: formData.isFlagship,
        isPPC: formData.isPPC,
        countryCodes: formData.countryCodes
          ? formData.countryCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
          : [],
        ...(aiStorePage !== undefined ? { aiStorePage } : {}),
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
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
        {/* Header (pinned) */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Edit Advertiser (#${advertiser?.id})` : "Add New Advertiser"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">
              {error}
            </div>
          )}

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
              <label className="block text-xs font-medium text-gray-700">Primary Country Code</label>
              <input
                type="text"
                maxLength={2}
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.toUpperCase() })}
                placeholder="e.g. US, PK, GB"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Supported Countries (comma-separated)</label>
              <input
                type="text"
                value={formData.countryCodes}
                onChange={(e) => setFormData({ ...formData, countryCodes: e.target.value })}
                placeholder="e.g. US, CA, GB, AU"
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
                <label className="block text-xs font-medium text-gray-700">Categories (comma-separated or click tags below)</label>
                <input
                  type="text"
                  value={formData.categories}
                  onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                  placeholder="e.g. Electronics & Tech, Fashion & Apparel"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {availableCategories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {availableCategories.map((cat) => {
                      const currentList = formData.categories.split(",").map((c) => c.trim()).filter(Boolean);
                      const isSelected = currentList.includes(cat.name);
                      return (
                        <button
                          key={cat.id || cat.slug}
                          type="button"
                          onClick={() => {
                            let newList: string[];
                            if (isSelected) {
                              newList = currentList.filter((c) => c !== cat.name);
                            } else {
                              newList = [...currentList, cat.name];
                            }
                            setFormData({ ...formData, categories: newList.join(", ") });
                          }}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                            isSelected
                              ? "bg-accent text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {cat.icon} {cat.name}
                        </button>
                      );
                    })}
                  </div>
                )}
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



              <div className="flex items-center gap-3 sm:col-span-2 mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <input
                  type="checkbox"
                  id="isPPC"
                  checked={formData.isPPC}
                  onChange={(e) => setFormData({ ...formData, isPPC: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                />
                <label htmlFor="isPPC" className="text-sm font-medium text-gray-900 cursor-pointer">
                  PPC Advertiser
                  <span className="block text-xs text-amber-700 font-normal">Internal use only — flags this advertiser as PPC in the admin dashboard. Never shown on public pages.</span>
                </label>
              </div>

              {/* SEO Title & Description Controls */}
              <div className="sm:col-span-2 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700">
                    SEO Title (Store Page & Meta)
                  </label>
                  {formData.maxDiscount && (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      Top Discount: {formData.maxDiscount}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mb-1">
                  Custom SEO title. If left blank, it is automatically generated from deal max discount analysis on first visit.
                </p>
                <input
                  type="text"
                  value={formData.seoTitle}
                  onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                  placeholder="e.g. Nike Promo Codes & Up to 50% Off Coupons (March 2026)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-700">
                  SEO Short Description (Meta Description)
                </label>
                <p className="text-[11px] text-gray-400 mb-1">
                  Very short, concise description without AI fluff. Displays under store title and in Google search results.
                </p>
                <textarea
                  rows={2}
                  value={formData.seoDescription}
                  onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                  placeholder="e.g. Save up to 50% off at Nike with verified promo codes, discount vouchers, and deals for March 2026."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          {/* AI Store Page content (editable JSON) */}
          {isEditing && (
            <div className="mt-6 border-t border-gray-100 pt-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Store Page Content (AI)
              </label>
              <p className="mt-0.5 mb-2 text-[11px] text-gray-400">
                Shown on the public store page. Edit the JSON directly, or use “Generate Store Page”
                below to (re)create it, then Save. Clear the field to remove it.
              </p>
              <textarea
                rows={10}
                value={storePageJson}
                onChange={(e) => setStorePageJson(e.target.value)}
                placeholder='{ "hero_heading": "…", "hero_intro": "…", "faq": [ … ] }'
                spellCheck={false}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-800 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          )}
          </div>

          {/* Footer Actions (pinned) */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleGenerateStorePage}
                  disabled={aiBusy}
                  title="Generate the public store page content with Claude"
                  className="rounded-lg border border-accent px-3 py-2 text-xs font-medium text-accent hover:bg-accent hover:text-white transition disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-accent"
                >
                  {aiBusy ? "Generating…" : "✨ Generate Store Page"}
                </button>
              )}
              {aiMsg && <span className="text-xs text-emerald-600">{aiMsg}</span>}
            </div>
            <div className="flex items-center gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}
