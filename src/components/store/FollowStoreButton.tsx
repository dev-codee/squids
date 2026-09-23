"use client";

import { useState } from "react";

interface FollowStoreButtonProps {
  store: {
    slug: string;
    network: string;
    advertiserId: string;
    name: string;
  };
  /** 2-letter region code from the current URL, used to build email links. */
  country: string;
}

type Frequency = "instant" | "daily" | "weekly";

const FREQUENCY_OPTIONS: { value: Frequency; label: string; hint: string }[] = [
  { value: "instant", label: "Instantly", hint: "As soon as a new offer appears" },
  { value: "daily", label: "Daily digest", hint: "One email a day, if there's something new" },
  { value: "weekly", label: "Weekly digest", hint: "One email a week, if there's something new" },
];

/**
 * "Follow this store" — lets a shopper subscribe to email alerts for new
 * offers from this store. Opens a small form (email + frequency + consent),
 * posts to /api/subscriptions, and shows a confirmation-pending state.
 */
export default function FollowStoreButton({ store, country }: FollowStoreButtonProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("instant");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<"pending" | "active" | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, frequency, country, store }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      setResult(data.needsConfirmation ? "pending" : "active");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        Follow {store.name} for offer alerts
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {result ? (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {result === "pending" ? "Check your inbox" : "You're all set"}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {result === "pending"
                    ? `We sent a confirmation link to ${email}. Click it to start getting alerts for ${store.name}.`
                    : `You'll get ${frequency} alerts for new offers from ${store.name}.`}
                </p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setResult(null);
                  }}
                  className="mt-6 w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-bold text-gray-900">Follow {store.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get an email when {store.name} adds a new offer or coupon.
                </p>

                <label className="block mt-4 text-sm font-medium text-gray-700">
                  Email address
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  />
                </label>

                <fieldset className="mt-4">
                  <legend className="text-sm font-medium text-gray-700">How often?</legend>
                  <div className="mt-2 space-y-2">
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-start gap-2 rounded-lg border border-gray-200 p-2.5 cursor-pointer hover:border-amber-300"
                      >
                        <input
                          type="radio"
                          name="frequency"
                          value={opt.value}
                          checked={frequency === opt.value}
                          onChange={() => setFrequency(opt.value)}
                          className="mt-0.5 accent-amber-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-800">{opt.label}</span>
                          <span className="block text-xs text-gray-500">{opt.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="mt-4 flex items-start gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span>
                    I agree to receive email alerts about new offers from {store.name}. I can
                    unsubscribe anytime — every email includes a one-click unsubscribe link.
                  </span>
                </label>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !consent}
                    className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Following…" : "Follow store"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
