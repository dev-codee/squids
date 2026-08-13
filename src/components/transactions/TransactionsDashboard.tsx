"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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

export interface TransactionsDashboardProps {
  title?: string;
  subtitle?: string;
  /** Optional "back" link rendered above the header (used by network pages). */
  backHref?: { href: string; label: string };
  /** Optional badge shown next to the title. */
  badge?: { label: string; className: string };
}

/**
 * Awin transaction analytics — summary cards, charts and a filterable table.
 * Reused by the top-level Dashboard and the Networks → Awin dashboard.
 */
export default function TransactionsDashboard({
  title = "Transactions Dashboard",
  subtitle = "View and analyse your Awin transaction data, commissions, and performance.",
  backHref,
  badge,
}: TransactionsDashboardProps) {
  const { startDate: defStart, endDate: defEnd } = defaultDates();

  const [startDate, setStartDate] = useState(defStart);
  const [endDate, setEndDate] = useState(defEnd);
  const [status, setStatus] = useState("");
  const [advertiserId, setAdvertiserId] = useState("");
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState("transactionDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);

  const [data, setData] = useState<PageData | null>(null);
  const [allFiltered, setAllFiltered] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [facets, setFacets] = useState<TransactionFacets>({
    statuses: [],
    advertisers: [],
  });

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

    const url = `/api/transactions?${params}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        {backHref && (
          <Link
            href={backHref.href}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            {backHref.label}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            {title}
          </h1>
          {badge && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      </header>

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
              load(startDate, endDate, status, advertiserId, search, sortBy, sortDir, page)
            }
            className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {loading || !data ? (
            <SummaryCardsSkeleton />
          ) : (
            <SummaryCards summary={data.summary} />
          )}

          {loading || !data ? (
            <ChartsSkeleton />
          ) : (
            <TransactionCharts
              transactions={data.transactions}
              allFiltered={allFiltered}
            />
          )}

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
