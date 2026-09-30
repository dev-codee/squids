"use client";

import type { StoreData } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";

/**
 * "Store information" — the merchant-fact rows from the brief. Each row states
 * what it covers and links to the merchant's own source, so nothing here is an
 * unsourced claim about delivery, returns or payment.
 */
export default function StoreInfoPanel({ store }: { store: StoreData }) {
  const dict = useDictionary();
  const t = dict.storeV2;
  const url = store.websiteUrl;

  const rows = [
    { label: t.deliveryCharges, desc: t.infoDelivery.replace("{store}", store.name) },
    { label: t.returnsRefunds, desc: t.infoReturns },
    { label: t.paymentOptions, desc: t.infoPayments },
    { label: t.aboutStore.replace("{store}", store.name), desc: t.infoAbout },
  ];

  return (
    <section className="overflow-hidden rounded-card border border-line bg-white">
      <h2 className="border-b border-line px-5 py-3.5 text-base font-bold text-ink">
        {t.storeInformation}
      </h2>
      <ul className="divide-y divide-line">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{row.label}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{row.desc}</span>
            </span>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="nofollow noopener noreferrer sponsored"
                className="flex-shrink-0 text-xs font-semibold text-brand underline-offset-2 hover:underline"
              >
                {t.readMerchantTerms} ↗
              </a>
            ) : (
              <span className="flex-shrink-0 text-xs text-ink-muted">
                {t.notAvailable}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
