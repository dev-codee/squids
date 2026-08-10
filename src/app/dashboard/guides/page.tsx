"use client";

import { useCallback, useEffect, useState } from "react";
import type { BuyingGuide, Paged } from "@/lib/content";
import Pagination from "@/components/Pagination";
import GuideModal from "@/components/admin/GuideModal";

const PAGE_SIZE = 24;

export default function AdminGuidesPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<BuyingGuide> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState<BuyingGuide | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (currentPage: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/guides-list?page=${currentPage}&pageSize=${PAGE_SIZE}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load guides.");
      setData(json as Paged<BuyingGuide>);
    } catch (err) { setError(err instanceof Error ? err.message : "Error."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page); }, [page, load]);
  function goToPage(next: number) { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleDelete(id: number) {
    if (!confirm(`Delete Guide #${id}?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/guides?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      load(page);
    } catch (err) { alert("Error deleting guide."); }
    finally { setDeletingId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Buying Guides</h1>
          <p className="mt-1 text-sm text-gray-500">Manage buying guides for stores.</p>
        </div>
        <button onClick={() => { setSelectedGuide(null); setIsModalOpen(true); }} className="bg-accent px-4 py-2 text-xs font-semibold text-white rounded-lg hover:bg-accent-hover">Add Guide</button>
      </header>
      {error ? (
        <div className="text-center p-8 bg-red-50 text-red-800 rounded-xl">{error}</div>
      ) : (
        <div className="space-y-6">
          {loading ? <div className="text-center py-10">Loading...</div> : !data || data.total === 0 ? <div className="text-center py-12 text-gray-500 bg-white border border-dashed rounded-xl">No guides found.</div> : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {data.items.map(g => (
                  <div key={g.id} className="relative group p-4 bg-white border rounded-xl hover:shadow-md">
                    <p className="text-xs text-gray-500">Adv ID: {g.advertiserId} • {g.category}</p>
                    <p className="font-bold text-sm mt-2">{g.title}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{g.summary}</p>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-2">
                      <button onClick={() => { setSelectedGuide(g); setIsModalOpen(true); }} className="text-xs p-1 text-gray-500 hover:text-accent">Edit</button>
                      <button onClick={() => handleDelete(g.id)} disabled={deletingId === g.id} className="text-xs p-1 text-red-500 hover:text-red-700">Del</button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPageChange={goToPage} />
            </>
          )}
        </div>
      )}
      <GuideModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSaved={() => load(page)} guide={selectedGuide} />
    </main>
  );
}
