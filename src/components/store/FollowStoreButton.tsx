"use client";

import { useDialogFocus } from "@/components/common/useDialogFocus";
import { useDictionary } from "@/i18n/DictionaryProvider";
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
  /** Smaller inline style for the header placement. */
  compact?: boolean;
  /** Overrides the trigger label (e.g. "Save store" in the store header). */
  label?: string;
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
export default function FollowStoreButton({ store, country, compact, label }: FollowStoreButtonProps) {
  const ui = useDictionary().offerUi;
  const text = (value: string) => value.replace("{store}", store.name).replace("{email}", email);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("instant");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus(open, () => setOpen(false));
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
        setError(ui.error);
        return;
      }
      setResult(data.needsConfirmation ? "pending" : "active");
    } catch {
      setError(ui.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex items-center justify-center gap-1.5 rounded-[9px] border border-line-strong bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-brand-border hover:text-brand"
            : "w-full flex items-center justify-center gap-2 rounded-[9px] border border-brand-border bg-brand-soft px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-white"
        }
      >
        <svg className={compact ? "h-4 w-4" : "h-4 w-4"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {label ?? (compact ? ui.followShort : text(ui.follow))}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={text(ui.follow)} tabIndex={-1} className="max-h-[90dvh] overflow-y-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {result ? (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-ink">
                  {result === "pending" ? ui.inbox : ui.ready}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {result === "pending"
                    ? text(ui.pending)
                    : text(ui.active)}
                </p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setResult(null);
                  }}
                  className="mt-6 w-full rounded-xl bg-canvas-sunk px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-canvas-sunk"
                >
                  {ui.close}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-bold text-ink">{text(ui.follow)}</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {text(ui.followIntro)}
                </p>

                <label className="block mt-4 text-sm font-medium text-ink-soft">
                  {ui.email}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                  />
                </label>

                <fieldset className="mt-4">
                  <legend className="text-sm font-medium text-ink-soft">{ui.frequency}</legend>
                  <div className="mt-2 space-y-2">
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-start gap-2 rounded-lg border border-line p-2.5 cursor-pointer hover:border-brand-border"
                      >
                        <input
                          type="radio"
                          name="frequency"
                          value={opt.value}
                          checked={frequency === opt.value}
                          onChange={() => setFrequency(opt.value)}
                          className="mt-0.5 accent-brand"
                        />
                        <span>
                          <span className="block text-sm font-medium text-ink">{ui[opt.value]}</span>
                          <span className="block text-xs text-ink-soft">{ui[`${opt.value}Hint`]}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="mt-4 flex items-start gap-2 text-xs text-ink-soft">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 accent-brand"
                  />
                  <span>
                    {text(ui.consent)}
                  </span>
                </label>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-canvas"
                  >
                    {ui.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !consent}
                    className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? ui.following : ui.followStore}
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
