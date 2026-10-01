"use client";

import { useDictionary } from "@/i18n/DictionaryProvider";

/**
 * Price history.
 *
 * Nothing records observed prices over time yet, so this always renders the
 * empty state the brief prescribes rather than a synthesised chart. When a
 * tracking job starts writing observations, feed them in here.
 */
export default function PriceHistoryPanel() {
  const dict = useDictionary();
  const t = dict.productV2;

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <h2 className="text-base font-bold text-ink">{t.priceHistory}</h2>
      <div className="mt-4 flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-canvas px-6 py-10 text-center">
        <span className="text-ink-muted" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          </svg>
        </span>
        <p className="mt-3 text-sm font-medium text-ink-soft">{t.historyEmpty}</p>
        <p className="mt-1 text-xs text-ink-muted">{t.historyNone}</p>
      </div>
    </section>
  );
}
