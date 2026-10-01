"use client";

import { useDictionary } from "@/i18n/DictionaryProvider";
import { useCurrency } from "@/i18n/CurrencyProvider";

/**
 * Target-price alert.
 *
 * There is no product-alert backend yet — the subscriptions module follows
 * stores, not product prices — so the form renders disabled rather than
 * collecting an email address it cannot act on.
 */
export default function PriceAlertCard() {
  const dict = useDictionary();
  const t = dict.productV2;
  const { region } = useCurrency();

  return (
    <section className="rounded-card border border-line bg-brand-soft/70 p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-ink">{t.alertTitle}</h2>
        <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
          {t.comingSoon}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{t.alertBody}</p>

      <div className="mt-4 flex items-center gap-2 opacity-60">
        <span className="rounded-[9px] border border-line bg-white px-3 py-2 text-sm font-medium text-ink-muted">
          {region.currency}
        </span>
        <input
          type="text"
          disabled
          placeholder="25.00"
          aria-label={t.alertTitle}
          className="w-full min-w-0 cursor-not-allowed rounded-[9px] border border-line bg-white px-3 py-2 text-sm text-ink-muted"
        />
      </div>
      <button
        type="button"
        disabled
        className="mt-3 w-full cursor-not-allowed rounded-[9px] bg-brand px-4 py-2.5 text-sm font-semibold text-white opacity-50"
      >
        {t.setPriceAlert}
      </button>
    </section>
  );
}
