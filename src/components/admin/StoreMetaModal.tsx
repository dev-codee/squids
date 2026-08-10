"use client";

import { useEffect, useState, useRef } from "react";
import type { StoreMeta } from "@/lib/storeMeta";
import type { Advertiser } from "@/lib/awin";

interface StoreMetaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  storeMeta: StoreMeta | null;
}

export default function StoreMetaModal({
  isOpen,
  onClose,
  onSaved,
  storeMeta,
}: StoreMetaModalProps) {
  const isEditing = Boolean(storeMeta);

  const emptyForm = {
    advertiserId: "",
    slug: "",
    rating: "0",
    categories: "",
    bannerUrl: "",
    description: "",
    avgSavings: "",
  };

  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Advertiser Search State
  const [advSearch, setAdvSearch] = useState("");
  const [advResults, setAdvResults] = useState<Advertiser[]>([]);
  const [isSearchingAdv, setIsSearchingAdv] = useState(false);
  const [showAdvDropdown, setShowAdvDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (storeMeta) {
      setFormData({
        advertiserId: String(storeMeta.advertiserId),
        slug: storeMeta.slug || "",
        rating: String(storeMeta.rating),
        categories: storeMeta.categories ? storeMeta.categories.join(", ") : "",
        bannerUrl: storeMeta.bannerUrl || "",
        description: storeMeta.description || "",
        avgSavings: storeMeta.avgSavings || "",
      });
      setAdvSearch(String(storeMeta.advertiserId)); // Pre-fill search with ID for context
    } else {
      setFormData(emptyForm);
      setAdvSearch("");
    }
    setError(null);
    setAdvResults([]);
    setShowAdvDropdown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeMeta, isOpen]);

  // Search Advertisers on type
  useEffect(() => {
    if (isEditing) return; // Don't search if we're just editing an existing one
    if (advSearch.trim().length < 2) {
      setAdvResults([]);
      setShowAdvDropdown(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingAdv(true);
      try {
        const res = await fetch(`/api/advertisers?search=${encodeURIComponent(advSearch)}&pageSize=5`);
        const data = await res.json();
        setAdvResults(data.advertisers || []);
        setShowAdvDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingAdv(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [advSearch, isEditing]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = "/api/admin/store-meta";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        id: Number(formData.advertiserId), // 1:1 mapping! id IS advertiserId
        advertiserId: Number(formData.advertiserId),
        slug: formData.slug || null,
        rating: Number(formData.rating),
        categories: formData.categories
          ? formData.categories.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        bannerUrl: formData.bannerUrl || null,
        description: formData.description || null,
        avgSavings: formData.avgSavings || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to save store meta.");
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
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? `Edit Store Meta (Adv ID: ${storeMeta?.advertiserId})` : "Add Store Meta"}
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
            
            {/* Advertiser Search / ID */}
            <div className="relative sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">
                {isEditing ? "Advertiser ID" : "Search Advertiser *"}
              </label>
              {isEditing ? (
                <input
                  type="text"
                  disabled
                  value={formData.advertiserId}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-gray-100"
                />
              ) : (
                <>
                  <input
                    type="text"
                    required
                    value={advSearch}
                    onChange={(e) => {
                      setAdvSearch(e.target.value);
                      if (formData.advertiserId) setFormData({ ...formData, advertiserId: "" }); // Reset on new type
                    }}
                    placeholder="Search by name (e.g. Nike)"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      formData.advertiserId ? "border-emerald-500 ring-emerald-500 bg-emerald-50" : "border-gray-300 focus:border-accent focus:ring-accent"
                    }`}
                  />
                  {formData.advertiserId && (
                    <span className="absolute right-3 top-8 text-xs font-bold text-emerald-600">✓ Selected ID: {formData.advertiserId}</span>
                  )}
                  {isSearchingAdv && (
                    <span className="absolute right-3 top-8 text-xs text-gray-400">Searching...</span>
                  )}
                  {showAdvDropdown && advResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      {advResults.map((adv) => (
                        <div
                          key={adv.id}
                          className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, advertiserId: String(adv.id) });
                            setAdvSearch(adv.name);
                            setShowAdvDropdown(false);
                          }}
                        >
                          <p className="text-sm font-semibold text-gray-900">{adv.name}</p>
                          <p className="text-xs text-gray-500">ID: {adv.id}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {showAdvDropdown && advResults.length === 0 && advSearch.length >= 2 && !isSearchingAdv && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm text-gray-500">
                      No advertisers found.
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Custom Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g. amazon (overrides auto slug)"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Store Rating (0-5)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                required
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                placeholder="e.g. 4.5"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Categories (comma separated)</label>
              <input
                type="text"
                value={formData.categories}
                onChange={(e) => setFormData({ ...formData, categories: e.target.value })}
                placeholder="e.g. Electronics, Home, Clothing"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Banner URL</label>
              <input
                type="url"
                value={formData.bannerUrl}
                onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Store Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the store..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Average Savings</label>
              <input
                type="text"
                value={formData.avgSavings}
                onChange={(e) => setFormData({ ...formData, avgSavings: e.target.value })}
                placeholder="e.g. $25 or 30%"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

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
              disabled={submitting || (!isEditing && !formData.advertiserId)}
              className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition disabled:opacity-50"
            >
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Meta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
