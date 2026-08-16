"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Deal } from "@/lib/deals";
import { countryName } from "@/lib/countries";
import Pagination from "@/components/Pagination";
import SkeletonGrid from "@/components/SkeletonGrid";

const PAGE_SIZE = 24;

interface PageData {
  deals: Deal[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

function storeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function DealCard({ deal, country }: { deal: Deal; country: string }) {
  const slug = storeSlug(deal.advertiser.name);
  const discount = deal.discountText?.trim();

  return (
    <Link
      href={`/${country.toLowerCase()}/${slug}`}
      className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {deal.advertiser.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.advertiser.logoUrl}
              alt={`${deal.advertiser.name} logo`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <span className="text-base font-semibold text-gray-400">
              {deal.advertiser.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {deal.advertiser.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {deal.type === "voucher" ? (
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                CODE
              </span>
            ) : (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                DEAL
              </span>
            )}
            {deal.isExclusive && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                EXCLUSIVE
              </span>
            )}
          </div>
        </div>
        {discount && (
          <span className="flex-shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
            {discount}
          </span>
        )}
      </div>

      <h3 className="mt-4 line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-amber-600">
        {deal.title}
      </h3>
      {deal.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">{deal.description}</p>
      )}

      <div className="mt-auto pt-4">
        {deal.code ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
            <span className="truncate font-mono text-xs font-semibold text-gray-700">
              {deal.code}
            </span>
            <span className="ml-2 flex-shrink-0 text-xs font-medium text-amber-600">
              Reveal →
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
            Get this deal <span aria-hidden>→</span>
          </span>
        )}
      </div>
    </Link>
  );
}

export default function TopDealsClient({ country }: { country: string }) {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (currentPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          country,
          // No status filter: show every available deal for this region,
          // including "expiring-soon" and admin-created deals with no status.
        });
        const res = await fetch(`/api/deals?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load deals.");
        }
        setData(json as PageData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [country],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  function goToPage(next: number) {
    setPage(next);
    load(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Top Deals
          </h1>
          <p className="mt-2 text-base text-gray-500">
            The best active coupons, promo codes, and offers in {countryName(country)}.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-medium text-red-800">Couldn&apos;t load deals</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              onClick={() => load(page)}
              className="mt-4 inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <SkeletonGrid />
        ) : !data || data.total === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-700">No active deals right now</p>
            <p className="mt-1 text-sm text-gray-500">
              Check back soon — fresh promotions are added regularly.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.deals.map((deal) => (
                <DealCard key={`${deal.network}-${deal.id}`} deal={deal} country={country} />
              ))}
            </div>

            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onPageChange={goToPage}
            />
          </div>
        )}
      </main>
    </div>
  );
}
