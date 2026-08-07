"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Advertiser } from "@/lib/awin";
import type { Deal } from "@/lib/deals";
import { countryFlag, countryName } from "@/lib/countries";
import DealCard from "@/components/DealCard";
import DealCardSkeleton from "@/components/DealCardSkeleton";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 24;

interface PageData {
  deals: Deal[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

interface AdvertiserDetailClientProps {
  country: string;
  slug: string;
}

export default function AdvertiserDetailClient({
  country,
  slug,
}: AdvertiserDetailClientProps) {
  const [advertiser, setAdvertiser] = useState<Advertiser | null>(null);
  const [advertiserLoading, setAdvertiserLoading] = useState(true);

  const [dealsData, setDealsData] = useState<PageData | null>(null);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [dealsPage, setDealsPage] = useState(1);

  // Fetch advertiser info
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAdvertiserLoading(true);
      try {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
          relationship: "joined",
          country,
        });
        const res = await fetch(`/api/advertisers?${params.toString()}`);
        const json = await res.json();
        if (!cancelled && json.advertisers) {
          const generateSlug = (name: string) =>
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "");

          const match = (json.advertisers as Advertiser[]).find(
            (a) => generateSlug(a.name) === slug,
          );
          setAdvertiser(match ?? null);
        }
      } catch {
        // Silently fail — deals will still load
      } finally {
        if (!cancelled) setAdvertiserLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, country]);

  // Fetch deals for this advertiser
  const loadDeals = useCallback(
    async (currentPage: number, adId: number) => {
      setDealsLoading(true);
      setDealsError(null);
      try {
        const params = new URLSearchParams({
          advertiserId: String(adId),
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
          country,
          status: "active",
        });
        const res = await fetch(`/api/deals?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? "Failed to load deals.");
        }
        setDealsData(json as PageData);
      } catch (err) {
        setDealsError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      } finally {
        setDealsLoading(false);
      }
    },
    [country],
  );

  useEffect(() => {
    if (advertiser) {
      loadDeals(1, advertiser.id);
    } else if (!advertiserLoading) {
      setDealsLoading(false);
    }
  }, [advertiser, advertiserLoading, loadDeals]);

  function goToPage(next: number) {
    if (advertiser) {
      setDealsPage(next);
      loadDeals(next, advertiser.id);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }

  const c = country.toLowerCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href={`/${c}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to advertisers
        </Link>

        {/* Advertiser header */}
        {advertiserLoading ? (
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-4">
              <div className="skeleton h-16 w-16 rounded-xl" />
              <div className="space-y-2">
                <div className="skeleton h-5 w-48 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
              </div>
            </div>
          </div>
        ) : advertiser ? (
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-card">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                {advertiser.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={advertiser.logoUrl}
                    alt={`${advertiser.name} logo`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-gray-400">
                    {advertiser.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold text-gray-900">
                  {advertiser.name}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  {advertiser.region && (
                    <span className="flex items-center gap-1">
                      <span aria-hidden>
                        {countryFlag(advertiser.countryCode)}
                      </span>
                      {advertiser.region}
                    </span>
                  )}
                  {advertiser.commission && (
                    <span>Commission: {advertiser.commission}</span>
                  )}
                  {advertiser.status && (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium capitalize text-green-700 ring-1 ring-inset ring-green-600/20">
                      {advertiser.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-card">
            <p className="text-sm text-gray-500">
              Advertiser "{slug}" in{" "}
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>{countryFlag(country)}</span>
                {countryName(country)}
              </span>
            </p>
          </div>
        )}

        {/* Deals section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Active Deals</h2>

          {dealsError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
              <p className="text-sm font-medium text-red-800">
                Couldn&apos;t load deals
              </p>
              <p className="mt-1 text-sm text-red-600">{dealsError}</p>
              <button
                onClick={() => loadDeals(dealsPage, advertiser!.id)}
                className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                Try again
              </button>
            </div>
          ) : dealsLoading ? (
            <DealCardSkeleton />
          ) : !dealsData || dealsData.total === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-sm font-medium text-gray-700">
                No active deals right now for this advertiser
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Check back later for new promotions and vouchers.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dealsData.deals.map((d) => (
                  <DealCard key={d.id} deal={d} />
                ))}
              </div>

              <Pagination
                page={dealsData.page}
                totalPages={dealsData.totalPages}
                total={dealsData.total}
                pageSize={dealsData.pageSize}
                onPageChange={goToPage}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
