"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreMeta, PagedStoreMeta } from "@/lib/storeMeta";
import Pagination from "@/components/Pagination";
import StoreMetaModal from "@/components/admin/StoreMetaModal";

const PAGE_SIZE = 24;

export default function AdminStoreMetaPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PagedStoreMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<StoreMeta | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (currentSearch: string, currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      });
      if (currentSearch) params.set("search", currentSearch);

      const res = await fetch(`/api/admin/store-meta-list?${params.toString()}`); // wait, we need a list api endpoint!
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to load store meta.");
      }
      setData(json as PagedStoreMeta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(search, 1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, load]);

  function goToPage(next: number) {
    setPage(next);
    load(search, next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleCreate() {
    setSelectedMeta(null);
    setIsModalOpen(true);
  }

  function handleEdit(meta: StoreMeta) {
    setSelectedMeta(meta);
    setIsModalOpen(true);
  }

  async function handleDelete(id: number) {
    if (!confirm(`Are you sure you want to delete store meta #${id}?`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/store-meta?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to delete store meta.");
      }
      load(search, page);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting store meta.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Store Meta Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage rich metadata for stores.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Store Meta
        </button>
      </header>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search slug or categories..."
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <svg
            className="absolute left-3 top-2.5 text-gray-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">
            Couldn&apos;t load store meta
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() => load(search, page)}
            className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-10 text-gray-500">Loading...</div>
          ) : !data || data.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-700">
                No store meta matches your filters
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.storeMetas.map((m) => (
                  <div key={m.id} className="relative group rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                    <h3 className="text-sm font-bold text-gray-900">Advertiser ID: {m.advertiserId}</h3>
                    <p className="text-xs text-gray-500 mt-1">Slug: {m.slug || "(Auto)"}</p>
                    <p className="text-xs text-gray-500 mt-1">Categories: {m.categories.join(", ") || "None"}</p>
                    <p className="text-xs text-gray-500 mt-1">Rating: {m.rating}</p>

                    <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-lg bg-white/95 p-1 shadow-md border border-gray-200 backdrop-blur-sm transition opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleEdit(m)}
                        title="Edit"
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-accent transition"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        title="Delete"
                        className="rounded p-1 text-gray-600 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={data.pageSize}
                onPageChange={goToPage}
              />
            </>
          )}
        </div>
      )}

      <StoreMetaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => load(search, page)}
        storeMeta={selectedMeta}
      />
    </main>
  );
}
