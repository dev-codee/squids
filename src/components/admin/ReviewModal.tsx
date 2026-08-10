"use client";

import { useEffect, useState, useRef } from "react";
import type { StoreReview } from "@/lib/content";
import type { Advertiser } from "@/lib/awin";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  review: StoreReview | null;
}

export default function ReviewModal({
  isOpen,
  onClose,
  onSaved,
  review,
}: ReviewModalProps) {
  const isEditing = Boolean(review);

  const emptyForm = {
    id: "",
    advertiserId: "",
    author: "",
    rating: "5",
    date: new Date().toISOString().split("T")[0],
    title: "",
    comment: "",
    verifiedBuyer: true,
  };

  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [advSearch, setAdvSearch] = useState("");
  const [advResults, setAdvResults] = useState<Advertiser[]>([]);
  const [isSearchingAdv, setIsSearchingAdv] = useState(false);
  const [showAdvDropdown, setShowAdvDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (review) {
      setFormData({
        id: String(review.id),
        advertiserId: String(review.advertiserId),
        author: review.author,
        rating: String(review.rating),
        date: review.date.split("T")[0], // assuming ISO
        title: review.title,
        comment: review.comment,
        verifiedBuyer: review.verifiedBuyer,
      });
      setAdvSearch(String(review.advertiserId));
    } else {
      setFormData(emptyForm);
      setAdvSearch("");
    }
    setError(null);
    setAdvResults([]);
    setShowAdvDropdown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, isOpen]);

  useEffect(() => {
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
  }, [advSearch]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = "/api/admin/reviews";
      const method = isEditing ? "PUT" : "POST";

      const payload = {
        id: formData.id ? Number(formData.id) : undefined,
        advertiserId: Number(formData.advertiserId),
        author: formData.author,
        rating: Number(formData.rating),
        date: new Date(formData.date).toISOString(),
        title: formData.title,
        comment: formData.comment,
        verifiedBuyer: formData.verifiedBuyer,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save review.");

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
            {isEditing ? `Edit Review (#${review?.id})` : "Add Store Review"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800 border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700">Search Advertiser *</label>
              <input type="text" required value={advSearch}
                onChange={(e) => {
                  setAdvSearch(e.target.value);
                  if (formData.advertiserId) setFormData({ ...formData, advertiserId: "" });
                }}
                placeholder="e.g. Nike"
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${formData.advertiserId ? "border-emerald-500 ring-emerald-500 bg-emerald-50" : "border-gray-300 focus:border-accent focus:ring-accent"}`}
              />
              {formData.advertiserId && <span className="absolute right-3 top-8 text-xs font-bold text-emerald-600">✓ ID: {formData.advertiserId}</span>}
              {showAdvDropdown && advResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                  {advResults.map((adv) => (
                    <div key={adv.id} className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100" onClick={() => {
                        setFormData({ ...formData, advertiserId: String(adv.id) });
                        setAdvSearch(adv.name);
                        setShowAdvDropdown(false);
                      }}>
                      <p className="text-sm font-semibold text-gray-900">{adv.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Author Name *</label>
              <input type="text" required value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Rating (1-5) *</label>
              <input type="number" required min="1" max="5" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Date</label>
              <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Review Title *</label>
              <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700">Comment *</label>
              <textarea required rows={4} value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>

            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" checked={formData.verifiedBuyer} onChange={(e) => setFormData({ ...formData, verifiedBuyer: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
              <label className="text-xs font-medium text-gray-700">Verified Buyer</label>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={submitting || !formData.advertiserId} className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition disabled:opacity-50">
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
