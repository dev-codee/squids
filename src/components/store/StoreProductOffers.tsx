"use client";

import type { ProductFeedItem } from "@/lib/storeData";
import { useCurrency } from "@/i18n/CurrencyProvider";
import { useDictionary } from "@/i18n/DictionaryProvider";

/**
 * "Product offers at this store" — exact variants the merchant currently
 * offers, with the price basis shown and two distinct actions: compare the
 * price here, or go to the disclosed merchant destination.
 */
export default function StoreProductOffers({
  products,
  storeName,
}: {
  products: ProductFeedItem[];
  storeName: string;
}) {
  const dict = useDictionary();
  const t = dict.storeV2;
  const { format } = useCurrency();

  if (!products.length) return null;

  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink">{t.productOffersTitle}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{t.productOffersSubtitle}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.slice(0, 6).map((p) => (
          <article
            key={p.id}
            className="flex flex-col overflow-hidden rounded-card border border-line bg-white"
          >
            <div className="flex h-40 items-center justify-center bg-canvas-sunk p-4">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.title}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-sm text-ink-muted">{p.title.charAt(0)}</span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                {p.title}
              </h3>
              {p.category && (
                <p className="mt-1 text-xs text-ink-muted">{p.category}</p>
              )}

              <p className="mt-2.5 text-base font-bold text-ink">{format(p.salePrice)}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {p.inStock ? storeName : `${storeName} · ${t.notAvailable}`}
              </p>

              <div className="mt-auto space-y-2 pt-3">
                <a
                  href={p.affiliateUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="block rounded-[9px] bg-brand px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                >
                  {t.viewCurrentPrice}
                </a>
                <a
                  href={p.affiliateUrl}
                  target="_blank"
                  rel="nofollow noopener noreferrer sponsored"
                  className="block rounded-[9px] border border-brand px-4 py-2 text-center text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
                >
                  {t.viewAtRetailer}
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
