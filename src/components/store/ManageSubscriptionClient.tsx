"use client";

import { useEffect, useState } from "react";

type Frequency = "instant" | "daily" | "weekly";

interface SubscriptionState {
  email: string;
  status: "pending" | "confirmed" | "unsubscribed";
  frequency: Frequency;
  stores: { slug: string; name: string }[];
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  instant: "Instantly",
  daily: "Daily digest",
  weekly: "Weekly digest",
};

const STATUS_BANNERS: Record<string, { tone: "success" | "info" | "error"; text: string }> = {
  confirmed: { tone: "success", text: "Your alerts are confirmed — you're all set." },
  unsubscribed: { tone: "info", text: "You've been unsubscribed from these alerts." },
  invalid: { tone: "error", text: "That link is invalid or has expired." },
};

export default function ManageSubscriptionClient({
  token,
  statusFlag,
}: {
  token: string | null;
  statusFlag: string | null;
}) {
  const [data, setData] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/subscriptions/manage?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("not found");
        setData(await res.json());
      })
      .catch(() => setError("We couldn't find that subscription."))
      .finally(() => setLoading(false));
  }, [token]);

  async function post(body: Record<string, unknown>) {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...body }),
      });
      if (res.ok) setData(await res.json());
    } finally {
      setBusy(false);
    }
  }

  const banner = statusFlag ? STATUS_BANNERS[statusFlag] : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Manage your store alerts</h1>

      {banner && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            banner.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : banner.tone === "error"
                ? "bg-red-50 text-red-700"
                : "bg-blue-50 text-blue-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      {!token && (
        <p className="mt-6 text-sm text-gray-500">
          Use the "Manage your alerts" link from one of your alert emails to view or change your
          preferences here.
        </p>
      )}

      {token && loading && <p className="mt-6 text-sm text-gray-500">Loading…</p>}
      {token && error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {data && (
        <div className="mt-8 space-y-8">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm text-gray-500">Signed up as</p>
            <p className="font-medium text-gray-900">{data.email}</p>
          </div>

          {data.status === "unsubscribed" ? (
            <p className="text-sm text-gray-500">
              You're fully unsubscribed. Follow a store again from its page any time.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 mb-3">How often?</h2>
                <div className="space-y-2">
                  {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                    <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="frequency"
                        checked={data.frequency === f}
                        disabled={busy}
                        onChange={() => post({ action: "frequency", frequency: f })}
                        className="accent-amber-500"
                      />
                      {FREQUENCY_LABELS[f]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 mb-3">Stores you follow</h2>
                {data.stores.length === 0 ? (
                  <p className="text-sm text-gray-500">You're not following any stores.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.stores.map((s) => (
                      <li key={s.slug} className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-800">{s.name}</span>
                        <button
                          disabled={busy}
                          onClick={() => post({ action: "removeStore", storeSlug: s.slug })}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Unfollow
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                disabled={busy}
                onClick={() => post({ action: "unsubscribeAll" })}
                className="text-sm font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                Unsubscribe from all alerts
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
