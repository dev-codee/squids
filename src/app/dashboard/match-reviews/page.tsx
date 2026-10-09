"use client";

import { useCallback, useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import type { Product } from "@/lib/products";
import type { MatchReview, MatchReviewStatus } from "@/lib/db/match-reviews";

/**
 * The manual match review desk.
 *
 * Every pair here is one a machine could not decide: either a title match with
 * no identifier behind it, or a shared identifier contradicted by a variant
 * field. Until someone rules, the public page shows the row as a candidate and
 * never as an exact match, so an untouched queue is safe — just incomplete.
 *
 * Four actions, as the brief specifies: approve, reject, split as variants, or
 * ask for better data. Approving records who approved it, because a manual
 * exact-match claim has to be attributable to a person.
 */

type QueueItem = MatchReview & { source: Product | null; candidate: Product | null };

interface QueueResponse {
  items: QueueItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pending: number;
}

const STATUS_TABS: { label: string; value: MatchReviewStatus | "all" }[] = [
  { label: "Pending", value: "pending" },
  { label: "Needs data", value: "needs-data" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Split variants", value: "split-variant" },
  { label: "All", value: "all" },
];

/** The identity fields a reviewer actually compares. */
const IDENTITY_FIELDS: { label: string; key: keyof Product }[] = [
  { label: "GTIN", key: "gtin" },
  { label: "Brand", key: "brand" },
  { label: "MPN", key: "mpn" },
  { label: "Size", key: "size" },
  { label: "Colour", key: "colour" },
  { label: "Flavour", key: "flavour" },
  { label: "Pack", key: "packCount" },
  { label: "Condition", key: "condition" },
  { label: "Regional spec", key: "regionalSpec" },
];

export default function MatchReviewQueuePage() {
  const [status, setStatus] = useState<MatchReviewStatus | "all">("pending");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [busyPair, setBusyPair] = useState<string | null>(null);

  // The reviewer's name is kept for the session so each decision carries it
  // without retyping. It is never defaulted — an unnamed approval is refused.
  useEffect(() => {
    setReviewer(window.localStorage.getItem("matchReviewer") ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/match-reviews?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load the queue.");
      setData(json as QueueResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function rule(pairId: string, decision: Exclude<MatchReviewStatus, "pending">) {
    if (decision === "approved" && !reviewer.trim()) {
      alert("Enter your name before approving a match — approvals are attributed.");
      return;
    }
    const notes = decision === "needs-data" ? prompt("What data is missing?") ?? "" : "";
    setBusyPair(pairId);
    try {
      window.localStorage.setItem("matchReviewer", reviewer.trim());
      const res = await fetch("/api/admin/match-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairId, status: decision, reviewedBy: reviewer.trim(), notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save the decision.");
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving the decision.");
    } finally {
      setBusyPair(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Match review
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Product pairs that could not be matched on identifiers alone. Until one is
            approved, the public comparison shows it as a candidate, never as an exact
            match.
            {data ? ` ${data.pending} pending.` : ""}
          </p>
        </div>
        <label className="text-xs font-semibold text-gray-600">
          <span className="block">Reviewer</span>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="your name"
            className="mt-1 w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal"
          />
        </label>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              status === tab.value
                ? "bg-accent text-white"
                : "border border-gray-200 bg-white text-gray-700 hover:border-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm font-medium text-red-800">
          <p>{error}</p>
          <button onClick={load} className="mt-4 rounded-lg bg-accent px-4 py-2 text-white">
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : !data || data.total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm font-medium text-gray-700">
          Nothing in this queue.
        </div>
      ) : (
        <div className="space-y-6">
          {data.items.map((item) => (
            <article
              key={item.pairId}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.reason}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.reviewBasis ?? "unclassified"} · pair {item.pairId}
                    {item.reviewedBy ? ` · ruled by ${item.reviewedBy}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-[11px] font-semibold ${
                    item.status === "pending"
                      ? "bg-amber-50 text-amber-800"
                      : item.status === "approved"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              {item.conflicts.length > 0 && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  Conflicting fields: {item.conflicts.join(", ")}
                </p>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <IdentityCard
                  heading="This listing"
                  title={item.sourceTitle}
                  product={item.source}
                  advertiserId={item.sourceAdvertiserId}
                  conflicts={item.conflicts}
                />
                <IdentityCard
                  heading="Candidate"
                  title={item.candidateTitle}
                  product={item.candidate}
                  advertiserId={item.candidateAdvertiserId}
                  conflicts={item.conflicts}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={busyPair === item.pairId}
                  onClick={() => rule(item.pairId, "approved")}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Approve as the same product
                </button>
                <button
                  disabled={busyPair === item.pairId}
                  onClick={() => rule(item.pairId, "rejected")}
                  className="rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={busyPair === item.pairId}
                  onClick={() => rule(item.pairId, "split-variant")}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Split as different variants
                </button>
                <button
                  disabled={busyPair === item.pairId}
                  onClick={() => rule(item.pairId, "needs-data")}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"
                >
                  Request better data
                </button>
              </div>

              {item.notes && (
                <p className="mt-2 text-xs text-gray-500">Notes: {item.notes}</p>
              )}
            </article>
          ))}

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
    </main>
  );
}

function IdentityCard({
  heading,
  title,
  product,
  advertiserId,
  conflicts,
}: {
  heading: string;
  title: string;
  product: Product | null;
  advertiserId: number;
  conflicts: string[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {heading} · advertiser {advertiserId}
      </p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{title}</p>
      {product ? (
        <dl className="mt-3 space-y-1 text-xs">
          {IDENTITY_FIELDS.map((field) => {
            const value = product[field.key];
            const conflicting = conflicts.includes(String(field.key));
            return (
              <div key={field.label} className="flex justify-between gap-3">
                <dt className="text-gray-500">{field.label}</dt>
                <dd
                  className={
                    conflicting ? "font-semibold text-red-700" : "text-gray-900"
                  }
                >
                  {value === null || value === undefined || value === ""
                    ? "—"
                    : String(value)}
                </dd>
              </div>
            );
          })}
          <div className="flex justify-between gap-3 border-t border-gray-100 pt-1">
            <dt className="text-gray-500">Price</dt>
            <dd className="text-gray-900">
              {typeof product.salePrice === "number" ? product.salePrice : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          Product record not found — it may have been removed since this pair was queued.
        </p>
      )}
    </div>
  );
}
