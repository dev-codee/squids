"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PpcStatusBadge from "@/components/admin/PpcStatusBadge";
import { describeNextAction, isFollowupOverdue, type PagedPpcPermissions, type PpcPermission } from "@/lib/ppc";

type QueueView = "queue" | "needs_review" | "overdue" | "incomplete";

const VIEWS: { id: QueueView; label: string; blurb: string }[] = [
  {
    id: "needs_review",
    label: "Needs your review",
    blurb: "A merchant replied. Read it and record approve or refuse — replies are never auto-classified.",
  },
  {
    id: "overdue",
    label: "Follow-up overdue",
    blurb: "The follow-up window has passed. The hourly job will send the single follow-up on its next run.",
  },
  {
    id: "incomplete",
    label: "Blocked — missing details",
    blurb: "Ready to go out but the contact email or landing page isn't usable, so every job skips them.",
  },
  {
    id: "queue",
    label: "Everything in flight",
    blurb: "Every record that isn't yet closed out.",
  },
];

/**
 * Outreach Queue — what is pending, what is overdue, and what is stuck.
 *
 * Also the place to trigger a single send by hand, which is how the dry-run flow
 * is validated end to end against your own inbox.
 */
export default function AdminPpcQueuePage() {
  const [view, setView] = useState<QueueView>("needs_review");
  const [includeTest, setIncludeTest] = useState(true);
  const [data, setData] = useState<PagedPpcPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async (currentView: QueueView, withTest: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view: currentView, pageSize: "100" });
      if (withTest) params.set("includeTest", "1");
      const res = await fetch(`/api/admin/ppc-permissions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load the queue.");
      setData(json as PagedPpcPermissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(view, includeTest);
  }, [view, includeTest, load]);

  /** Fire one send by hand. Every eligibility guard still applies server-side. */
  async function trigger(p: PpcPermission, action: "send_now" | "followup_now", dryRun: boolean) {
    const label = action === "send_now" ? "initial request" : "follow-up";
    const target = dryRun ? "your PPC_TEST_EMAIL inbox" : `${p.contactEmail}`;
    if (!confirm(`Send the ${label} for ${p.merchantName} to ${target}?\n\nThis can only ever happen once per merchant.`)) {
      return;
    }

    setBusyId(p._id!);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/ppc-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: p._id, dryRun }),
      });
      const json = await res.json();
      if (json.ok) {
        const detail = json.result?.details?.[0];
        setFlash({ kind: "ok", text: `Sent the ${label} for ${p.merchantName} to ${detail?.to ?? target}.` });
      } else {
        setFlash({ kind: "err", text: json.error ?? json.result?.details?.[0]?.note ?? "Send did not go out." });
      }
      load(view, includeTest);
    } catch (err) {
      setFlash({ kind: "err", text: err instanceof Error ? err.message : "Request failed." });
    } finally {
      setBusyId(null);
    }
  }

  const active = VIEWS.find((v) => v.id === view)!;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/ppc"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-accent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Merchant Directory
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Outreach Queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          One initial request and one follow-up per merchant, ever. The jobs enforce that in the
          database, so a manual send here can never double up.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
              view === v.id ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => setIncludeTest(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          Include dry-run records
        </label>
      </div>

      <p className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{active.blurb}</p>

      {flash && (
        <div
          className={`mb-4 rounded-lg border p-3 text-xs font-medium ${
            flash.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {flash.text}
        </div>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm font-medium text-red-800">
          <p>{error}</p>
          <button onClick={() => load(view, includeTest)} className="mt-4 rounded-lg bg-accent px-4 py-2 text-white">
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-gray-500">Loading…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm font-medium text-gray-700">
          Nothing here. {view === "needs_review" ? "No replies waiting on you." : "Queue is clear."}
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((p) => {
            const overdue = isFollowupOverdue(p);
            const lastMessage = p.messages[p.messages.length - 1];
            return (
              <div
                key={p._id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/ppc/${p._id}`}
                        className="text-sm font-bold text-gray-900 hover:text-accent"
                      >
                        {p.merchantName}
                      </Link>
                      <PpcStatusBadge status={p.status} showHint />
                      {p.country && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                          {p.country}
                        </span>
                      )}
                      {p.isTest && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          dry run
                        </span>
                      )}
                      {overdue && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
                          overdue
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-600">{describeNextAction(p)}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      {p.contactEmail ?? "no contact email"}
                      {p.sentAt && ` · requested ${p.sentAt.slice(0, 10)}`}
                      {p.followupSentAt && ` · followed up ${p.followupSentAt.slice(0, 10)}`}
                    </p>

                    {p.lastSendError && (
                      <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
                        Last send failed: {p.lastSendError}
                      </p>
                    )}

                    {lastMessage && view === "needs_review" && (
                      <p className="mt-2 line-clamp-3 rounded bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700">
                        {lastMessage.body.slice(0, 300)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {p.status === "READY" && (
                      <>
                        <button
                          onClick={() => trigger(p, "send_now", true)}
                          disabled={busyId === p._id}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                        >
                          Test send
                        </button>
                        <button
                          onClick={() => trigger(p, "send_now", false)}
                          disabled={busyId === p._id}
                          className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                        >
                          Send request
                        </button>
                      </>
                    )}
                    {p.status === "REQUESTED" && overdue && (
                      <button
                        onClick={() => trigger(p, "followup_now", false)}
                        disabled={busyId === p._id}
                        className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
                      >
                        Send follow-up
                      </button>
                    )}
                    <Link
                      href={`/dashboard/ppc/${p._id}`}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      {p.status === "REVIEW_REPLY" ? "Read & decide" : "Open"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
