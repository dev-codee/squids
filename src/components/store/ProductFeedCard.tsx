"use client";

import type { ProductFeedItem } from "@/lib/storeData";
import { useCurrency } from "@/i18n/CurrencyProvider";

interface ProductFeedCardProps {
  product: ProductFeedItem;
}

/**
 * Product card for a store's own feed.
 *
 * `originalPrice`, `discountPercentage`, `rating` and `reviewsCount` are
 * hand-entered admin fields — no network client writes them, and they carry no
 * source or observation date. Showing them as a "was" price, a saving badge or
 * a star rating would present an unevidenced claim as fact, so they stay out of
 * the card until they carry provenance.
 */
export default function ProductFeedCard({ product }: ProductFeedCardProps) {
  const { format } = useCurrency();
  return (
    <div className="group flex flex-col justify-between rounded-card border border-line bg-white p-4 shadow-card transition hover:border-brand-border hover:shadow-card-hover">
      <div>
        <div className="relative mb-3 h-44 w-full overflow-hidden rounded-card bg-canvas-sunk">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {product.category && (
            <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-soft backdrop-blur-sm">
              {product.category}
            </span>
          )}
        </div>

        <h4 className="line-clamp-2 text-sm font-bold text-ink group-hover:text-brand">
          {product.title}
        </h4>

        <p className="mt-3 text-lg font-extrabold text-ink">
          {format(product.salePrice)}
        </p>
      </div>

      <a
        href={product.affiliateUrl}
        target="_blank"
        rel="nofollow noopener noreferrer sponsored"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-[9px] bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-hover"
      >
        View Product
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}
