"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import PpcPermissionModal from "@/components/admin/PpcPermissionModal";
import PpcStatusBadge from "@/components/admin/PpcStatusBadge";
import {
  PPC_STATUS_META,
  PPC_STATUS_ORDER,
  describeNextAction,
  type PagedPpcPermissions,
  type PpcPermission,
} from "@/lib/ppc";

const PAGE_SIZE = 30;

/**
 * Merchant Directory — every PPC permission record, filterable by status.
 *
 * This is the answer to "may we advertise on this merchant's brand terms?" — the
 * `deals` collection deliberately says nothing about it.
 */
export default function AdminPpcDirectoryPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);
  const [data, setData] = useState<PagedPpcPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<PpcPermission | null>(null);

  const load = useCallback(
    async (currentPage: number, currentStatus: string, currentSearch: string, withTest: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          status: currentStatus,
        });
        if (currentSearch.trim()) params.set("search", currentSearch.trim());
        if (withTest) params.set("includeTest", "1");

        const res = await fetch(`/api/admin/ppc-permissions?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Failed to load permission records.");
        setData(json as PagedPpcPermissions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timeout = setTimeout(() => load(page, status, search, includeTest), search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [page, status, search, includeTest, load]);

  function reload() {
    load(page, status, search, includeTest);
  }

  const totalRecords = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">PPC Merchant Directory</h1>
          <p className="mt-1 text-sm text-gray-500">
            Written permission to bid on a merchant&apos;s brand and coupon keywords, tracked per
            merchant and market. A new promotion never grants permission.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/dashboard/ppc/queue"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Outreach Queue
          </Link>
          <button
            onClick={() => {
              setSelected(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-hover"
          >
            Add merchant
          </button>
        </div>
      </header>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setStatus("all");
            setPage(1);
          }}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
            status === "all" ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({totalRecords})
        </button>
        {PPC_STATUS_ORDER.map((s) => {
          const count = data?.counts[s] ?? 0;
          return (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              title={PPC_STATUS_META[s].hint}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                status === s
                  ? "bg-accent text-white"
                  : `${PPC_STATUS_META[s].className} hover:opacity-80`
              }`}
            >
              {PPC_STATUS_META[s].label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search merchant, contact name or email…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:max-w-sm"
        />
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => {
              setIncludeTest(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          Include dry-run records
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm font-medium text-red-800">
          <p>{error}</p>
          <button onClick={reload} className="mt-4 rounded-lg bg-accent px-4 py-2 text-white">
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : !data || data.total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm font-medium text-gray-700">
          No permission records{status !== "all" ? ` with status ${status}` : ""}.
          <p className="mt-2 text-xs font-normal text-gray-500">
            Add a merchant to queue the first permission request.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">Merchant</th>
                  <th className="px-4 py-3">Market</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Next action</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/ppc/${p._id}`} className="font-semibold text-gray-900 hover:text-accent">
                        {p.merchantName}
                      </Link>
                      <p className="text-[11px] text-gray-500">
                        {p.network} · id {p.merchantId}
                        {p.isTest && (
                          <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">dry run</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.country ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{p.contactName ?? "—"}</p>
                      <p className="text-[11px] text-gray-500">{p.contactEmail ?? "no email"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PpcStatusBadge status={p.status} showHint />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{describeNextAction(p)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelected(p);
                          setIsModalOpen(true);
                        }}
                        className="rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 transition hover:bg-gray-50 hover:text-accent"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.pageSize}
            onPageChange={(next) => {
              setPage(next);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      )}

      <PpcPermissionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={reload}
        permission={selected}
      />
    </main>
  );
}
