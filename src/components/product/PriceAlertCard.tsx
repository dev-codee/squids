"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";
import type { AlertFrequency } from "@/lib/model/productAlert";

interface PriceAlertCardProps {
  productId?: number;
  productTitle?: string;
  currentPrice?: number | null;
}

export default function PriceAlertCard({
  productId,
  productTitle,
  currentPrice,
}: PriceAlertCardProps) {
  const dict = useDictionary();
  const t = dict.productV2;
  const { region } = useCurrency();
  const params = useParams();
  const country = (typeof params?.country === "string" ? params.country : "us").toLowerCase();

  const defaultTarget =
    typeof currentPrice === "number" && currentPrice > 0
      ? (currentPrice * 0.95).toFixed(2)
      : "";

  const [targetPrice, setTargetPrice] = useState(defaultTarget);
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<AlertFrequency>("instant");
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;
    if (!consent) {
      setErrorMessage("Please confirm consent to receive price alerts.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/product-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          productId,
          targetPrice: Number(targetPrice),
          frequency,
          country,
          consent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set up alert");
      }

      setSuccessMessage(
        data.message || "Alert registered! Please check your inbox to confirm.",
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-card border border-line bg-brand-soft/70 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-ink">{t.alertTitle}</h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t.alertBody}</p>

      {successMessage ? (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-800" role="alert">
          <p className="text-sm font-semibold">{successMessage}</p>
          <p className="mt-1 text-xs text-emerald-700">
            A confirmation link has been sent to {email}. You won't receive emails until confirmed.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {errorMessage && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800" role="alert">
              {errorMessage}
            </div>
          )}

          {/* Target Price */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Target Price ({region.currency})
            </label>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-[9px] border border-line bg-white px-3 py-2 text-sm font-medium text-ink-muted">
                {region.currency}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="25.00"
                aria-label={t.alertTitle}
                className="w-full min-w-0 rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Notification Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
              className="mt-1 w-full rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              <option value="instant">Instant (as soon as observed)</option>
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly digest</option>
            </select>
          </div>

          {/* Consent */}
          <div className="pt-1">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs text-ink-soft">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line-strong text-brand focus:ring-brand"
              />
              <span>
                Notify me when this product reaches my target price. One-click unsubscribe is available in every email.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-[9px] bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:opacity-60"
          >
            {submitting ? "Setting alert..." : t.setPriceAlert}
          </button>
        </form>
      )}
    </section>
  );
}
