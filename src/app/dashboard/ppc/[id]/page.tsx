"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PpcStatusBadge from "@/components/admin/PpcStatusBadge";
import { PPC_STATUS_META, describeNextAction, type PpcBrandInAdText, type PpcPermission } from "@/lib/ppc";
import type { PpcLaunchGateResult } from "@/lib/ppc/gate";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/**
 * Permission detail — the full email thread, the evidence, and the manual
 * approve / refuse decision.
 *
 * Deciding is deliberately a human action on this page: a reply saying "yes on
 * brand terms but not brand+coupon in DE" is a distinction no classifier should
 * be trusted with when the downstream risk is a trademark complaint.
 */
export default function AdminPpcDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [permission, setPermission] = useState<PpcPermission | null>(null);
  const [gate, setGate] = useState<PpcLaunchGateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Approve form
  const [scope, setScope] = useState("");
  const [evidence, setEvidence] = useState("");
  const [brandInAdText, setBrandInAdText] = useState<PpcBrandInAdText>("unanswered");
  const [signOffBy, setSignOffBy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ppc-permissions?id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to load the permission record.");

      const p = json.permission as PpcPermission;
      setPermission(p);
      setScope(p.permissionScope ?? "");
      setBrandInAdText(p.brandInAdText);
      setSignOffBy(p.economicsSignedOffBy ?? "");

      // Pre-fill the evidence box with the merchant's last inbound message so
      // approving is a read-and-confirm, not a copy-paste job.
      if (!p.evidence) {
        const lastInbound = [...p.messages].reverse().find((m) => m.direction === "inbound");
        setEvidence(lastInbound?.body ?? "");
      } else {
        setEvidence(p.evidence);
      }

      const gateParams = new URLSearchParams({
        merchantId: String(p.merchantId),
        network: p.network,
      });
      if (p.country) gateParams.set("country", p.country);
      if (p.landingPage) gateParams.set("landingPage", p.landingPage);
      if (p.keywordsScope) gateParams.set("keywords", p.keywordsScope);

      const gateRes = await fetch(`/api/admin/ppc-permissions/gate?${gateParams.toString()}`);
      if (gateRes.ok) setGate((await gateRes.json()) as PpcLaunchGateResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(body: Record<string, unknown>, successText: string) {
    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/ppc-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json?.error ?? "Action failed.");
      setFlash({ kind: "ok", text: successText });
      await load();
    } catch (err) {
      setFlash({ kind: "err", text: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setBusy(false);
    }
  }

  function handleApprove() {
    if (!scope.trim() || !evidence.trim()) {
      setFlash({
        kind: "err",
        text: "Both the agreed scope and the evidence are required — an approval without them can't satisfy the launch gate.",
      });
      return;
    }
    if (!confirm("Record written permission with this exact scope?")) return;
    patch(
      { action: "approve", permissionScope: scope, evidence, brandInAdText },
      "Written permission recorded.",
    );
  }

  function handleRefuse(action: "refuse" | "do_not_contact") {
    const label = action === "refuse" ? "REFUSED" : "DO NOT CONTACT";
    if (!confirm(`Mark this merchant ${label}? They will be excluded from every automated send, permanently.`)) {
      return;
    }
    patch({ action, evidence: evidence.trim() || undefined }, `Merchant marked ${label}.`);
  }

  async function handleDeleteTestRecord() {
    if (!confirm("Delete this dry-run record?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ppc-permissions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed.");
      router.push("/dashboard/ppc");
    } catch (err) {
      setFlash({ kind: "err", text: err instanceof Error ? err.message : "Delete failed." });
      setBusy(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-4 py-8 text-center text-gray-500">Loading…</main>;
  }

  if (error || !permission) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm font-medium text-red-800">
          <p>{error ?? "Permission record not found."}</p>
          <Link href="/dashboard/ppc" className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-white">
            Back to directory
          </Link>
        </div>
      </main>
    );
  }

  const p = permission;
  const decided = p.status === "APPROVED" || p.status === "REFUSED" || p.status === "DO_NOT_CONTACT";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{p.merchantName}</h1>
          <PpcStatusBadge status={p.status} />
          {p.isTest && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              dry run
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {p.network} · merchant id {p.merchantId} · market {p.country ?? "—"} ·{" "}
          {PPC_STATUS_META[p.status].hint}
        </p>
        <p className="mt-1 text-xs font-medium text-gray-600">{describeNextAction(p)}</p>
      </header>

      {flash && (
        <div
          className={`mb-6 rounded-lg border p-3 text-xs font-medium ${
            flash.kind === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {flash.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: thread + decision */}
        <div className="space-y-6 lg:col-span-2">
          {/* Email thread */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Email thread</h2>
            {p.messages.length === 0 ? (
              <p className="text-xs text-gray-500">Nothing sent yet.</p>
            ) : (
              <ol className="space-y-3">
                {p.messages.map((m, i) => (
                  <li
                    key={`${m.messageId ?? "m"}-${i}`}
                    className={`rounded-lg border p-3 ${
                      m.direction === "inbound"
                        ? "border-amber-200 bg-amber-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-gray-500">
                        {m.direction === "inbound" ? "Reply" : m.kind === "followup" ? "Follow-up" : m.kind}
                      </span>
                      <span className="text-gray-500">{new Date(m.at).toLocaleString()}</span>
                      {m.isTest && (
                        <span className="rounded bg-amber-200 px-1 font-semibold text-amber-900">dry run</span>
                      )}
                    </div>
                    {m.subject && <p className="text-xs font-semibold text-gray-800">{m.subject}</p>}
                    <p className="text-[11px] text-gray-500">
                      {m.direction === "inbound" ? `from ${m.from ?? "—"}` : `to ${m.to ?? "—"}`}
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-gray-700">
                      {m.body}
                    </pre>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Decision */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              {decided ? "Recorded decision" : "Record the decision"}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Replies are never classified automatically. Read the thread above, then record exactly
              what was agreed — in the merchant&apos;s own words.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Agreed scope * <span className="font-normal text-gray-500">(exact permission granted)</span>
                </label>
                <textarea
                  rows={3}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="e.g. Brand + coupon keywords permitted in DE only. Brand name allowed in headline. No direct linking — must land on our store page."
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Evidence * <span className="font-normal text-gray-500">(their reply text, or a link to it)</span>
                </label>
                <textarea
                  rows={5}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="sm:w-1/2">
                <label className="block text-xs font-medium text-gray-700">Brand name in ad copy</label>
                <select
                  value={brandInAdText}
                  onChange={(e) => setBrandInAdText(e.target.value as PpcBrandInAdText)}
                  className={inputClass}
                >
                  <option value="unanswered">Unanswered</option>
                  <option value="allowed">Allowed</option>
                  <option value="prohibited">Prohibited</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                <button
                  onClick={handleApprove}
                  disabled={busy}
                  className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                >
                  {p.status === "APPROVED" ? "Update approval" : "Approve"}
                </button>
                <button
                  onClick={() => handleRefuse("refuse")}
                  disabled={busy}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  Refused
                </button>
                <button
                  onClick={() => handleRefuse("do_not_contact")}
                  disabled={busy}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Do not contact
                </button>
                {p.isTest && (
                  <button
                    onClick={handleDeleteTestRecord}
                    disabled={busy}
                    className="ml-auto rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                  >
                    Delete dry-run record
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right: requested scope, launch gate, sign-off */}
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Requested scope</h2>
            <dl className="space-y-2 text-xs">
              <Field label="Contact" value={p.contactName} />
              <Field label="Email" value={p.contactEmail} />
              <Field label="Market" value={p.country} />
              <Field label="Publisher ID" value={p.publisherId} />
              <Field label="Landing page" value={p.landingPage} isUrl />
              <Field label="Keywords" value={p.keywordsScope} />
              <Field label="Brand in ad copy" value={p.brandInAdText} />
              <Field label="Requested" value={p.sentAt?.slice(0, 10)} />
              <Field label="Follow-up due" value={p.followupAt?.slice(0, 10)} />
              <Field label="Follow-up sent" value={p.followupSentAt?.slice(0, 10)} />
              <Field label="Reply received" value={p.replyReceivedAt?.slice(0, 10)} />
              <Field label="Notes" value={p.notes} />
            </dl>
          </section>

          {/* Launch gate */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Campaign launch gate</h2>
              {gate && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    gate.launchable ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {gate.launchable ? "Launchable" : "Blocked"}
                </span>
              )}
            </div>

            {!gate ? (
              <p className="text-xs text-gray-500">Gate not evaluated.</p>
            ) : (
              <ul className="space-y-2.5">
                {gate.checks.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                        c.passed ? "bg-green-600" : "bg-red-500"
                      }`}
                    >
                      {c.passed ? "✓" : "✕"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{c.label}</p>
                      <p className="text-[11px] leading-relaxed text-gray-500">{c.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Economics sign-off */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Economics sign-off</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
              Manual by design. Type your name to sign off on the unit economics; clear it to withdraw
              the sign-off and re-block launch.
            </p>
            <input
              type="text"
              value={signOffBy}
              onChange={(e) => setSignOffBy(e.target.value)}
              placeholder="Your name"
              className={inputClass}
            />
            {p.economicsSignedOffAt && (
              <p className="mt-1.5 text-[11px] text-green-700">
                Signed off by {p.economicsSignedOffBy} on {p.economicsSignedOffAt.slice(0, 10)}
              </p>
            )}
            <button
              onClick={() =>
                patch(
                  { action: "economics_signoff", signedOffBy: signOffBy.trim() || null },
                  signOffBy.trim() ? "Economics sign-off recorded." : "Economics sign-off withdrawn.",
                )
              }
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {signOffBy.trim() ? "Save sign-off" : "Withdraw sign-off"}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  isUrl = false,
}: {
  label: string;
  value?: string | null;
  isUrl?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-gray-800">
        {!value ? (
          <span className="font-normal text-gray-400">—</span>
        ) : isUrl ? (
          <a href={value} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
