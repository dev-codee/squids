"use client";

import type { StoreData } from "@/lib/storeData";
import { useDictionary } from "@/i18n/DictionaryProvider";

/**
 * "Before you shop" rail: the merchant facts a shopper needs before committing
 * — delivery, returns, payment, support and current policies.
 *
 * We hold none of these as structured data, and the brief is explicit that
 * unknown facts are marked rather than guessed. So each row links to the
 * merchant's own site, where the live policy lives, instead of asserting a
 * figure we can't source.
 */
export default function StoreEssentials({
  store,
  country,
}: {
  store: StoreData;
  country: string;
}) {
  const dict = useDictionary();
  const t = dict.storeV2;


  const rows = [
    { url: store.policyUrls?.delivery, label: t.deliveryCharges, icon: <TruckIcon /> },
    { url: store.policyUrls?.returns, label: t.returnsRefunds, icon: <ReturnIcon /> },
    { url: store.policyUrls?.payment, label: t.paymentOptions, icon: <CardIcon /> },
    { url: store.policyUrls?.support, label: t.support, icon: <LifeIcon /> },
    { url: store.policyUrls?.policies, label: t.merchantPolicies, icon: <DocIcon /> },
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-card border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-ink">
          {t.beforeYouShop}
        </h2>
        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li key={row.label}>
              {row.url ? (
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 text-sm text-ink-soft transition-colors hover:bg-canvas hover:text-brand"
                >
                  <span className="flex-shrink-0 text-ink-muted" aria-hidden>
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{row.label}</span>
                  <span aria-hidden className="text-ink-muted">›</span>
                </a>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 text-sm text-ink-muted">
                  <span className="flex-shrink-0" aria-hidden>
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">{row.label}</span>
                  <span className="text-xs">{t.notAvailable}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line bg-canvas px-4 py-3 text-xs leading-relaxed text-ink-muted">
          {t.sourcedFromMerchant}
        </p>
      </section>

    </div>
  );
}

function TruckIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h11v9H2zM13 10h4l4 3.5V16h-8z" />
      <circle cx="6.5" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </svg>
  );
}
function ReturnIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  );
}
function LifeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="m5 5 4.5 4.5M19 5l-4.5 4.5M5 19l4.5-4.5M19 19l-4.5-4.5" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </svg>
  );
}
