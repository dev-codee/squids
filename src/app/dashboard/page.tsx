"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Transaction,
  TransactionSummary,
  TransactionFacets,
} from "@/lib/transactions";
import SummaryCards from "@/components/transactions/SummaryCards";
import TransactionCharts from "@/components/transactions/TransactionCharts";
import TransactionTable from "@/components/transactions/TransactionTable";
import TransactionFilters from "@/components/transactions/TransactionFilters";
import {
  SummaryCardsSkeleton,
  ChartsSkeleton,
  TableSkeleton,
} from "@/components/transactions/TransactionSkeletons";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default date range: last 30 days. */
function defaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

interface PageData {
  transactions: Transaction[];
  summary: TransactionSummary;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  facets: TransactionFacets;
}

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransactionsPage() {
  const { startDate: defStart, endDate: defEnd } = defaultDates();

  // Filters
  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);
  const [status, setStatus] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [search, setSearch] = useState("");

  // Sort
  const [sortBy, setSortBy] = useState("transactionDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(1);

  // Data
  const [data, setData] = useState<PageData | null>(null);
  const [allFiltered, setAllFiltered] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Facets persist across loads to avoid flicker
  const [facets, setFacets] = useState<TransactionFacets>({
    statuses: [],
    advertisers: [],
  });

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  const load = useCallback(
    async (
      sd: string,
      ed: string,
      st: string,
      adv: string,
      srch: string,
      sBy: string,
      sDir: string,
      pg: number,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          startDate: `${sd}T00:00:00Z`,
          endDate: `${ed}T23:59:59Z`,
          page: String(pg),
          pageSize: String(PAGE_SIZE),
          sortBy: sBy,
          sortDir: sDir,
        });
        if (st) params.set("status", st);
        if (adv) params.set("advertiserId", adv);
        if (srch) params.set("search", srch);

        const res = await fetch(`/api/transactions?${params}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load transactions.");
        }

        setData(json as PageData);
        if (json.facets) setFacets(json.facets);

        // Also fetch all filtered (no pagination) for charts
        const allParams = new URLSearchParams({
          startDate: `${sd}T00:00:00Z`,
          endDate: `${ed}T23:59:59Z`,
          pageSize: "100000",
          page: "1",
          sortBy: sBy,
          sortDir: sDir,
        });
        if (st) allParams.set("status", st);
        if (adv) allParams.set("advertiserId", adv);
        if (srch) allParams.set("search", srch);

        const allRes = await fetch(`/api/transactions?${allParams}`);
        const allJson = await allRes.json();
        if (allRes.ok) {
          setAllFiltered(allJson.transactions ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Debounced reload on filter changes
  // -------------------------------------------------------------------------

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      load(startDate, endDate, status, advertiserId, search, sortBy, sortDir, 1);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, status, advertiserId, search, sortBy, sortDir]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

  function handlePageChange(next: number) {
    setPage(next);
    load(startDate, endDate, status, advertiserId, search, sortBy, sortDir, next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleExportCsv() {
    const params = new URLSearchParams({
      startDate: `${startDate}T00:00:00Z`,
      endDate: `${endDate}T23:59:59Z`,
      format: "csv",
    });
    if (status) params.set("status", status);
    if (advertiserId) params.set("advertiserId", advertiserId);
    if (search) params.set("search", search);

    // Trigger download
    const url = `/api/transactions?${params}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Transactions Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          View and analyse your Awin transaction data, commissions, and
          performance.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-6">
        <TransactionFilters
          startDate={startDate}
          endDate={endDate}
          status={status}
          advertiserId={advertiserId}
          search={search}
          statuses={facets.statuses}
          advertisers={facets.advertisers}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onStatusChange={setStatus}
          onAdvertiserChange={setAdvertiserId}
          onSearchChange={setSearch}
          onExportCsv={handleExportCsv}
          loading={loading}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-medium text-red-800">
            Couldn&apos;t load transactions
          </p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            onClick={() =>
              load(
                startDate,
                endDate,
                status,
                advertiserId,
                search,
                sortBy,
                sortDir,
                page,
              )
            }
            className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          {loading || !data ? (
            <SummaryCardsSkeleton />
          ) : (
            <SummaryCards summary={data.summary} />
          )}

          {/* Charts */}
          {loading || !data ? (
            <ChartsSkeleton />
          ) : (
            <TransactionCharts
              transactions={data.transactions}
              allFiltered={allFiltered}
            />
          )}

          {/* Table */}
          {loading || !data ? (
            <TableSkeleton />
          ) : (
            <TransactionTable
              transactions={data.transactions}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={handleSort}
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      )}
    </main>
  );
}
