"use client";

import { useEffect, useState, useRef } from "react";
import type { FAQ } from "@/lib/content";
import type { Advertiser } from "@/lib/awin";

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  faq: FAQ | null;
}

export default function FAQModal({ isOpen, onClose, onSaved, faq }: FAQModalProps) {
  const isEditing = Boolean(faq);

  const emptyForm = { id: "", advertiserId: "", question: "", answer: "" };
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [advSearch, setAdvSearch] = useState("");
  const [advResults, setAdvResults] = useState<Advertiser[]>([]);
  const [showAdvDropdown, setShowAdvDropdown] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (faq) {
      setFormData({ id: String(faq.id), advertiserId: String(faq.advertiserId), question: faq.question, answer: faq.answer });
      setAdvSearch(String(faq.advertiserId));
    } else {
      setFormData(emptyForm);
      setAdvSearch("");
    }
    setError(null);
    setAdvResults([]);
    setShowAdvDropdown(false);
  }, [faq, isOpen]);

  useEffect(() => {
    if (advSearch.trim().length < 2) { setAdvResults([]); setShowAdvDropdown(false); return; }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/advertisers?search=${encodeURIComponent(advSearch)}&pageSize=5`);
        const data = await res.json();
        setAdvResults(data.advertisers || []);
        setShowAdvDropdown(true);
      } catch (err) {}
    }, 300);
  }, [advSearch]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...formData, id: formData.id ? Number(formData.id) : undefined, advertiserId: Number(formData.advertiserId) };
      const res = await fetch("/api/admin/faqs", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save FAQ.");
      onSaved(); onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{isEditing ? `Edit FAQ (#${faq?.id})` : "Add FAQ"}</h2>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700">Search Advertiser *</label>
            <input type="text" required value={advSearch} onChange={(e) => { setAdvSearch(e.target.value); if (formData.advertiserId) setFormData({ ...formData, advertiserId: "" }); }} className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${formData.advertiserId ? "border-emerald-500 ring-emerald-500 bg-emerald-50" : "border-gray-300 focus:border-accent focus:ring-accent"}`} />
            {formData.advertiserId && <span className="absolute right-3 top-8 text-xs font-bold text-emerald-600">✓ ID: {formData.advertiserId}</span>}
            {showAdvDropdown && advResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {advResults.map((adv) => (
                  <div key={adv.id} className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b" onClick={() => { setFormData({ ...formData, advertiserId: String(adv.id) }); setAdvSearch(adv.name); setShowAdvDropdown(false); }}>
                    <p className="text-sm font-semibold">{adv.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Question *</label>
            <input type="text" required value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">Answer *</label>
            <textarea required rows={4} value={formData.answer} onChange={(e) => setFormData({ ...formData, answer: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-xs font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting || !formData.advertiserId} className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
