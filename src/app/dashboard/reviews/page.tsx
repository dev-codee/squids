"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreReview, Paged } from "@/lib/content";
import Pagination from "@/components/Pagination";
import ReviewModal from "@/components/admin/ReviewModal";

const PAGE_SIZE = 24;

export default function AdminReviewsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<StoreReview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<StoreReview | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/reviews-list?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load reviews.");
      setData(json as Paged<StoreReview>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  function goToPage(next: number) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id: number) {
    if (!confirm(`Are you sure you want to delete review #${id}?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete review.");
      load(page);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting review.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Store Reviews</h1>
          <p className="mt-1 text-sm text-gray-500">Manage user reviews for stores.</p>
        </div>
        <button onClick={() => { setSelectedReview(null); setIsModalOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover">
          Add Review
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm font-medium text-red-800">
          <p>{error}</p>
          <button onClick={() => load(page)} className="mt-4 bg-accent px-4 py-2 text-white rounded-lg">Try again</button>
        </div>
      ) : (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading...</div>
          ) : !data || data.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm font-medium text-gray-700">
              No reviews found.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((r) => (
                  <div key={r.id} className="relative group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                    <h3 className="text-sm font-bold text-gray-900">Adv ID: {r.advertiserId}</h3>
                    <p className="text-xs font-semibold mt-1">★ {r.rating} / 5</p>
                    <p className="text-sm mt-1">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.comment}</p>
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => { setSelectedReview(r); setIsModalOpen(true); }} className="rounded p-1 bg-white shadow border text-gray-600 hover:text-accent">Edit</button>
                      <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id} className="rounded p-1 bg-white shadow border text-red-600 hover:bg-red-50">Del</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={goToPage} />
            </>
          )}
        </div>
      )}

      <ReviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSaved={() => load(page)} review={selectedReview} />
    </main>
  );
}
